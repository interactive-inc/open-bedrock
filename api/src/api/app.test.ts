import { describe, expect, test } from "bun:test"
import { app } from "@/api/app"
import type { Bindings } from "@/env"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/interface/test-helpers/load-schema"

const jwtSecret = "app-cors-test-secret"

function makeBindings(corsOrigin?: string): Bindings {
  return {
    DB: createD1TestDatabase(loadSchema()),
    JWT_SECRET: jwtSecret,
    AUDIT_HMAC_SECRET: "test-audit-hmac-secret",
    CORS_ORIGIN: corsOrigin,
    NOW: "2026-01-01T00:00:00.000Z",
  }
}

function preflight(origin: string, corsOrigin?: string): Promise<Response> {
  return Promise.resolve(
    app.request(
      "/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      },
      makeBindings(corsOrigin),
    ),
  )
}

describe("CORS", () => {
  test("CORS_ORIGIN 未設定時は localhost:3000 を許可する", async () => {
    const response = await preflight("http://localhost:3000")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000")
  })

  test("CORS_ORIGIN 未設定時は localhost:5173 も許可する", async () => {
    const response = await preflight("http://localhost:5173")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173")
  })

  test("CORS_ORIGIN 未設定時は未知の Origin を許可しない", async () => {
    const response = await preflight("https://evil.example.com")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  test("CORS_ORIGIN 設定時はそのオリジンのみ許可する", async () => {
    const response = await preflight("https://app.example.com", "https://app.example.com")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
  })

  test("CORS_ORIGIN にカンマ区切りで複数指定すると全て許可する", async () => {
    const allowList = "https://app.example.com,https://admin.example.com"

    const responseApp = await preflight("https://app.example.com", allowList)
    expect(responseApp.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")

    const responseAdmin = await preflight("https://admin.example.com", allowList)
    expect(responseAdmin.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://admin.example.com",
    )
  })

  test("CORS_ORIGIN 設定時はリスト外の Origin を許可しない（localhost も含む）", async () => {
    const response = await preflight("http://localhost:3000", "https://app.example.com")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })
})

describe("security headers", () => {
  test("レスポンスに X-Content-Type-Options: nosniff が付く", async () => {
    const response = await app.request("/health", { method: "GET" }, makeBindings())

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  })

  test("レスポンスに Strict-Transport-Security が付く", async () => {
    const response = await app.request("/health", { method: "GET" }, makeBindings())

    expect(response.headers.get("Strict-Transport-Security")).not.toBeNull()
  })

  test("別オリジン利用を阻害する CORP は付けない（CORS が制御を担う）", async () => {
    const response = await app.request("/health", { method: "GET" }, makeBindings())

    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBeNull()
  })
})

function makeLimiter(success: boolean): RateLimit {
  return { limit: () => Promise.resolve({ success }) }
}

describe("rate limiting", () => {
  test("binding 未設定ならレート制限をスキップする", async () => {
    const response = await app.request("/health", { method: "GET" }, makeBindings())

    expect(response.status).toBe(200)
  })

  test("上限超過(success:false)なら 429 を返す（認証前に弾く）", async () => {
    const bindings = { ...makeBindings(), API_RATE_LIMITER: makeLimiter(false) }

    const response = await app.request("/employees", { method: "GET" }, bindings)

    expect(response.status).toBe(429)
  })

  test("上限内(success:true)なら通常処理に進む（未認証で 401）", async () => {
    const bindings = { ...makeBindings(), API_RATE_LIMITER: makeLimiter(true) }

    const response = await app.request("/employees", { method: "GET" }, bindings)

    expect(response.status).toBe(401)
  })

  test("/health は binding があっても対象外", async () => {
    const bindings = { ...makeBindings(), API_RATE_LIMITER: makeLimiter(false) }

    const response = await app.request("/health", { method: "GET" }, bindings)

    expect(response.status).toBe(200)
  })
})

describe("rate limiting fail-closed (#1035)", () => {
  test("本番相当（CORS_ORIGIN 設定済み）で binding 未設定なら 503 で拒否する", async () => {
    const bindings = makeBindings("https://app.example.com")

    const response = await app.request("/employees", { method: "GET" }, bindings)

    expect(response.status).toBe(503)
  })

  test("本番相当でも /health は binding 未設定のまま通す（監視用）", async () => {
    const bindings = makeBindings("https://app.example.com")

    const response = await app.request("/health", { method: "GET" }, bindings)

    expect(response.status).toBe(200)
  })

  test("本番相当で RATE_LIMIT KV 未設定なら /auth/login は 503 で拒否する", async () => {
    const bindings = {
      ...makeBindings("https://app.example.com"),
      API_RATE_LIMITER: makeLimiter(true),
    }

    const response = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "you@example.com", password: "password" }),
      },
      bindings,
    )

    expect(response.status).toBe(503)
  })

  test("ローカル相当（CORS_ORIGIN 未設定）は binding 未設定でもスキップして通す", async () => {
    const response = await app.request("/employees", { method: "GET" }, makeBindings())

    expect(response.status).toBe(401)
  })
})
