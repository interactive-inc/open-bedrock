import { app } from "@/app"
import type { Bindings } from "@/env"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { requestContextMiddleware } from "@/interface/middlewares/request-context-middleware"
import { factory } from "@/interface/utils/factory"
import { describe, expect, test } from "bun:test"
import { z } from "zod"

const auditContextResponseSchema = z.object({
  request_id: z.string(),
  client_name: z.enum(["web", "cli", "api", "system"]),
  client_ip: z.string().nullable(),
  external_request_id: z.string().nullable(),
})

const contextProbeApp = factory
  .createApp()
  .use("*", requestContextMiddleware)
  .get("/", (c) => {
    const context = c.var.auditContext

    return c.json({
      request_id: context.requestId,
      client_name: context.clientName,
      client_ip: context.clientIp,
      external_request_id: context.externalRequestId,
    })
  })

const errorProbeApp = factory
  .createApp()
  .use("*", requestContextMiddleware)
  .onError((_error, c) => c.json({ error: "internal server error" }, 500))
  .get("/", () => {
    throw new Error("intentional request-context test error")
  })

function makeBindings(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: createD1TestDatabase(loadSchema()),
    JWT_SECRET: "request-context-test-secret",
    AUDIT_HMAC_SECRET: "request-context-hmac-test-secret",
    CORS_ORIGIN: "https://app.example.com",
    NOW: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function probe(headers: Record<string, string> = {}): Promise<Response> {
  return Promise.resolve(contextProbeApp.request("/", { headers }, makeBindings()))
}

describe("request audit context", () => {
  test("uses an internal UUID instead of a caller-controlled request ID", async () => {
    const response = await probe({
      "X-Request-ID": "caller-controlled",
      "X-Open-Karte-Client": "browser",
    })
    const body = auditContextResponseSchema.parse(await response.json())
    const responseRequestId = response.headers.get("x-request-id")

    expect(responseRequestId).not.toBeNull()
    if (responseRequestId === null) {
      throw new Error("X-Request-ID header is missing")
    }
    expect(responseRequestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.request_id).toBe(responseRequestId)
    expect(body.request_id).not.toBe("caller-controlled")
    expect(body.client_name).toBe("api")
    expect(body.external_request_id).toBe("caller-controlled")
  })

  test.each(["web", "cli"] as const)("accepts the %s HTTP client header", async (clientName) => {
    const response = await probe({ "X-Open-Karte-Client": clientName })
    const body = auditContextResponseSchema.parse(await response.json())

    expect(body.client_name).toBe(clientName)
  })

  test.each(["system", "browser", "WEB"])(
    "maps the unsupported %s HTTP client header to api",
    async (clientName) => {
      const response = await probe({ "X-Open-Karte-Client": clientName })
      const body = auditContextResponseSchema.parse(await response.json())

      expect(body.client_name).toBe("api")
    },
  )

  test("keeps a valid external request ID separate from the internal UUID", async () => {
    const externalRequestId = "job:2026/07/14.run-1"
    const response = await probe({ "X-Request-ID": externalRequestId })
    const body = auditContextResponseSchema.parse(await response.json())

    expect(body.external_request_id).toBe(externalRequestId)
    expect(body.request_id).not.toBe(externalRequestId)
  })

  test.each(["contains a space", "contains+plus", "x".repeat(129)])(
    "rejects an invalid external request ID",
    async (externalRequestId) => {
      const response = await probe({ "X-Request-ID": externalRequestId })
      const body = auditContextResponseSchema.parse(await response.json())

      expect(body.external_request_id).toBeNull()
    },
  )

  test("uses CF-Connecting-IP and ignores X-Forwarded-For", async () => {
    const trustedResponse = await probe({
      "CF-Connecting-IP": "192.0.2.20",
      "X-Forwarded-For": "198.51.100.30",
    })
    const trustedBody = auditContextResponseSchema.parse(await trustedResponse.json())
    expect(trustedBody.client_ip).toBe("192.0.2.20")

    const untrustedResponse = await probe({ "X-Forwarded-For": "198.51.100.30" })
    const untrustedBody = auditContextResponseSchema.parse(await untrustedResponse.json())
    expect(untrustedBody.client_ip).toBeNull()
  })

  test("adds the internal request ID to a body-limit response", async () => {
    const response = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: "https://app.example.com",
        },
        body: JSON.stringify({ payload: "x".repeat(1_000_001) }),
      },
      makeBindings(),
    )

    expect(response.status).toBe(413)
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("X-Request-ID")
  })

  test("adds the internal request ID to a rate-limit response", async () => {
    const limiter: RateLimit = { limit: () => Promise.resolve({ success: false }) }
    const response = await app.request(
      "/employees",
      {
        headers: {
          "CF-Connecting-IP": "192.0.2.50",
          Origin: "https://app.example.com",
        },
      },
      makeBindings({ API_RATE_LIMITER: limiter }),
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("X-Request-ID")
  })

  test("adds the internal request ID to an onError response", async () => {
    const response = await errorProbeApp.request("/", {}, makeBindings())

    expect(response.status).toBe(500)
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/)
  })

  test("exposes X-Request-ID through CORS", async () => {
    const response = await requestWithContext({
      db: createD1TestDatabase(loadSchema()),
      jwtSecret: "request-context-test-secret",
      path: "/health",
      token: null,
      headers: { Origin: "http://localhost:3000" },
    })

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000")
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("X-Request-ID")
  })
})
