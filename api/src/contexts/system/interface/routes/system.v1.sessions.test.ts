import { PasswordHashService } from "@system/infrastructure/auth/password-hash.service"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { SystemHttpError } from "@system/interface/http/system-http-error"
import {
  DELETE,
  GET,
  PATCH,
  POST,
  type SystemSessionHttpEnvironment,
} from "@system/interface/routes/system.v1.sessions"
import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

const issuedAt = new Date("2026-01-01T00:00:00.000Z")
const rotatedAt = new Date("2026-01-02T00:00:00.000Z")
const revokedAt = new Date("2026-01-03T00:00:00.000Z")
const accountId = "system-route-account"
const subject = "person@example.com"
const password = "correct-password"
const pepper = "system-session-test-pepper"
const jwtSecret = "system-session-route-test-secret"

function createApp() {
  const app = new Hono<SystemSessionHttpEnvironment>()
    .get("/system/v1/sessions", ...GET)
    .post("/system/v1/sessions", ...POST)
    .patch("/system/v1/sessions", ...PATCH)
    .delete("/system/v1/sessions", ...DELETE)

  app.onError((error, context) => {
    if (!(error instanceof SystemHttpError)) throw error
    return context.json({ error: error.detail, code: error.code, ...error.metadata }, error.status)
  })

  return app
}

describe("System Session HTTP", () => {
  test("password認証・検証・rotation・reuse検知・冪等失効をcanonical Systemで実行する", async () => {
    const fixture = new SystemSessionTestContext()
    const passwordHash = await PasswordHashService.hash(password, pepper)
    fixture.sqlite
      .query(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .run(accountId, issuedAt.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('password-identity', ?1, 'password', ?2, ?3, ?3, NULL)`,
      )
      .run(accountId, subject, issuedAt.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_password_credentials
           (identity_id, password_hash, changed_at, created_at, updated_at)
         VALUES ('password-identity', ?1, ?2, ?2, ?2)`,
      )
      .run(passwordHash, issuedAt.getTime())

    const app = createApp()
    const requestAtIssue = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: issuedAt.toISOString(),
        PEPPER_SECRET: pepper,
      })
    const requestAtRotation = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: rotatedAt.toISOString(),
        PEPPER_SECRET: pepper,
      })
    const requestAtRevocation = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: revokedAt.toISOString(),
        PEPPER_SECRET: pepper,
      })
    const issueClient = hc<typeof app>("http://system.test", { fetch: requestAtIssue })
    const rotationClient = hc<typeof app>("http://system.test", { fetch: requestAtRotation })
    const revocationClient = hc<typeof app>("http://system.test", { fetch: requestAtRevocation })

    const issued = await issueClient.system.v1.sessions.$post({
      json: { subject, password },
    })
    expect(issued.status).toBe(201)
    const issuedBody = await issued.json()
    expect("access_token" in issuedBody).toBe(true)
    expect("refresh_token" in issuedBody).toBe(true)
    if (!("access_token" in issuedBody) || !("refresh_token" in issuedBody)) return
    expect(issuedBody).toMatchObject({ account_id: accountId })

    const authenticated = await issueClient.system.v1.sessions.$get({
      header: { authorization: `Bearer ${issuedBody.refresh_token}` },
    })
    expect(authenticated.status).toBe(200)
    expect(await authenticated.json()).toMatchObject({
      account_id: accountId,
      session_id: issuedBody.session_id,
    })

    const rotated = await rotationClient.system.v1.sessions.$patch({
      json: { refresh_token: issuedBody.refresh_token },
    })
    expect(rotated.status).toBe(200)
    const rotatedBody = await rotated.json()
    expect("access_token" in rotatedBody).toBe(true)
    expect("refresh_token" in rotatedBody).toBe(true)
    if (!("access_token" in rotatedBody) || !("refresh_token" in rotatedBody)) return
    expect(rotatedBody.access_token).not.toBe(issuedBody.access_token)
    expect(rotatedBody.refresh_token).not.toBe(issuedBody.refresh_token)

    const reused = await revocationClient.system.v1.sessions.$patch({
      json: { refresh_token: issuedBody.refresh_token },
    })
    expect(Number(reused.status)).toBe(401)

    const familyRevoked = await revocationClient.system.v1.sessions.$get({
      header: { authorization: `Bearer ${rotatedBody.refresh_token}` },
    })
    expect(Number(familyRevoked.status)).toBe(401)

    const logout = await revocationClient.system.v1.sessions.$delete({
      json: { refresh_token: rotatedBody.refresh_token },
    })
    expect(logout.status).toBe(204)
  })

  test("未知subject・誤password・runtime不備を同じ安全な境界へ閉じる", async () => {
    const fixture = new SystemSessionTestContext()
    const app = createApp()
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        NOW: issuedAt.toISOString(),
        PEPPER_SECRET: pepper,
      })
    const client = hc<typeof app>("http://system.test", { fetch: request })

    const unknown = await client.system.v1.sessions.$post({
      json: { subject: "unknown@example.com", password: "wrong-password" },
    })
    expect(Number(unknown.status)).toBe(401)
    expect((await unknown.json()) as unknown).toEqual({
      error: "invalid credentials",
      code: "invalid_credentials",
    })

    expect(
      (
        await app.request(
          "/system/v1/sessions",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ subject, password }),
          },
          { DB: fixture.context.env.DB, NOW: issuedAt.toISOString() },
        )
      ).status,
    ).toBe(503)
    expect((await app.request("/system/v1/sessions")).status).toBe(503)
    expect(
      (
        await app.request(
          "/system/v1/sessions",
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refresh_token: "short" }),
          },
          { DB: fixture.context.env.DB },
        )
      ).status,
    ).toBe(400)
  })
})
