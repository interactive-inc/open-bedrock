import { zAccountId } from "@system/domain/auth/account-id"
import { createSystemSessionApplications } from "@system/infrastructure/auth/create-system-session-applications"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import {
  DELETE,
  GET,
  POST,
  type SystemSessionHttpEnvironment,
} from "@system/interface/routes/system.v1.sessions"
import { describe, expect, test } from "bun:test"
import { Hono } from "hono"

const issuedAt = new Date("2026-01-01T00:00:00.000Z")
const rotatedAt = new Date("2026-01-02T00:00:00.000Z")
const revokedAt = new Date("2026-01-03T00:00:00.000Z")
const accountId = zAccountId.parse("system-route-account")

describe("System Session HTTP", () => {
  test("検証・rotation・reuse検知・冪等失効をcanonical Systemで実行する", async () => {
    const fixture = new SystemSessionTestContext()
    fixture.sqlite
      .query(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`,
      )
      .run(accountId, issuedAt.getTime())

    const applications = createSystemSessionApplications({
      context: fixture.context,
      sessionTtlMilliseconds: 604_800_000,
    })
    if (applications instanceof Error) throw applications
    const issued = await applications.issue.execute({
      accountId,
      tokenVersion: 0,
      now: issuedAt,
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    if (issued instanceof Error || issued.kind !== "issued") throw new Error("issue failed")

    const app = new Hono<SystemSessionHttpEnvironment>()
      .get("/system/v1/sessions", ...GET)
      .post("/system/v1/sessions", ...POST)
      .delete("/system/v1/sessions", ...DELETE)

    const authenticated = await app.request(
      "/system/v1/sessions",
      { headers: { authorization: `Bearer ${issued.rawToken}` } },
      { DB: fixture.context.env.DB, NOW: issuedAt.toISOString() },
    )
    expect(authenticated.status).toBe(200)
    expect(await authenticated.json()).toMatchObject({
      account_id: accountId,
      session_id: issued.sessionId,
    })

    const rotated = await app.request(
      "/system/v1/sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: issued.rawToken }),
      },
      { DB: fixture.context.env.DB, NOW: rotatedAt.toISOString() },
    )
    expect(rotated.status).toBe(200)
    const rotatedBody = (await rotated.json()) as { refresh_token: string }
    expect(rotatedBody.refresh_token).not.toBe(issued.rawToken)

    const reused = await app.request(
      "/system/v1/sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: issued.rawToken }),
      },
      { DB: fixture.context.env.DB, NOW: revokedAt.toISOString() },
    )
    expect(reused.status).toBe(401)

    const familyRevoked = await app.request(
      "/system/v1/sessions",
      { headers: { authorization: `Bearer ${rotatedBody.refresh_token}` } },
      { DB: fixture.context.env.DB, NOW: revokedAt.toISOString() },
    )
    expect(familyRevoked.status).toBe(401)

    const logout = await app.request(
      "/system/v1/sessions",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh_token: rotatedBody.refresh_token }),
      },
      { DB: fixture.context.env.DB, NOW: revokedAt.toISOString() },
    )
    expect(logout.status).toBe(204)
  })

  test("credentialとruntime不備をfail closedにする", async () => {
    const app = new Hono<SystemSessionHttpEnvironment>()
      .get("/system/v1/sessions", ...GET)
      .post("/system/v1/sessions", ...POST)

    expect((await app.request("/system/v1/sessions")).status).toBe(503)
    expect((await app.request("/system/v1/sessions", {}, { DB: {} as D1Database })).status).toBe(
      401,
    )
    expect(
      (
        await app.request(
          "/system/v1/sessions",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refresh_token: "short" }),
          },
          { DB: {} as D1Database },
        )
      ).status,
    ).toBe(400)
  })
})
