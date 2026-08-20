import { expect, test } from "bun:test"
import { handleApiError } from "@/api/http/handle-api-error"
import { companyValidationErrorMiddleware } from "@/api/http/company-validation-error-middleware"
import { CompanyHttpError } from "@/contexts/company/interface/http/errors/company-http-error"
import { OidcHttpError } from "@system/interface/http/errors/oidc-http-error"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { ValidationError } from "@/lib/errors"
import type { HonoEnv } from "@/env"
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const app = new Hono<HonoEnv>()
  .onError(handleApiError)
  .use("*", companyValidationErrorMiddleware())
  .get("/company-conflict", () => {
    throw new CompanyHttpError({
      status: 409,
      code: "company_revision_conflict",
      detail: "Company revision has changed",
      etag: '"7"',
    })
  })
  .get("/company-unavailable", () => {
    throw new CompanyHttpError({
      status: 503,
      code: "company_read_unavailable",
      detail: "Company data could not be read",
      cause: new Error("secret database detail"),
    })
  })
  .get("/oidc-invalid-token", () => {
    throw new OidcHttpError({
      code: "invalid_token",
      status: 401,
      authenticate: 'Bearer error="invalid_token"',
    })
  })
  .get("/application-error", () => {
    throw toHttpException(new ValidationError("Request is invalid", "invalid_request"))
  })
  .post("/company/items", zValidator("json", z.object({ enabled: z.boolean() })), (context) =>
    context.json(context.req.valid("json")),
  )

test("Company HTTP エラーは onError だけで Problem Details と ETag へ変換する", async () => {
  const response = await app.request("/company-conflict")

  expect(response.status).toBe(409)
  expect(response.headers.get("content-type")).toBe("application/problem+json")
  expect(response.headers.get("etag")).toBe('"7"')
  expect(await response.json()).toEqual({
    type: "/problems/company_revision_conflict",
    title: "Conflict",
    status: 409,
    code: "company_revision_conflict",
    detail: "Company revision has changed",
  })
})

test("Company の 503 は原因を Problem Details へ漏らさない", async () => {
  const response = await app.request("/company-unavailable")

  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({
    type: "/problems/company_read_unavailable",
    title: "Service Unavailable",
    status: 503,
    code: "company_read_unavailable",
    detail: "Company data could not be read",
  })
})

test("OIDC エラーJSONと認証headerは onError だけが生成する", async () => {
  const response = await app.request("/oidc-invalid-token")

  expect(response.status).toBe(401)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("pragma")).toBe("no-cache")
  expect(response.headers.get("www-authenticate")).toBe('Bearer error="invalid_token"')
  expect(await response.json()).toEqual({ error: "invalid_token" })
})

test("application error の JSON も onError だけが生成する", async () => {
  const response = await app.request("/application-error")

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    error: "Request is invalid",
    code: "invalid_request",
  })
})

test("Company の既定 zValidator 失敗も onError で Problem Details にする", async () => {
  const response = await app.request("/company/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: "yes" }),
  })

  expect(response.status).toBe(400)
  expect(response.headers.get("content-type")).toBe("application/problem+json")
  expect(await response.json()).toEqual({
    type: "/problems/invalid_company_request",
    title: "Bad Request",
    status: 400,
    code: "invalid_company_request",
    detail: "Company request is invalid",
  })
})
