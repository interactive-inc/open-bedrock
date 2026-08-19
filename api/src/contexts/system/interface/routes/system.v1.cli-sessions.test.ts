import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import type { SystemHonoEnv } from "@system/interface/http/system-factory"
import { POST } from "@system/interface/routes/system.v1.cli-sessions"
import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const jwtSecret = "cli-session-route-jwt-secret"

function createFixture() {
  const fixture = new SystemSessionTestContext()
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES ('cli-session-account', 'active', 0, ?1, ?1)`,
    )
    .run(now.getTime())
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/v1/cli-sessions", ...POST)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
      }),
  })

  return Object.freeze({ client, fixture })
}

async function seedCode(
  fixture: SystemSessionTestContext,
  code: string,
  expiresAt = now.getTime() + 60_000,
): Promise<void> {
  const codeHash = await systemLoginCodeHash(code)
  if (codeHash instanceof Error) throw codeHash
  fixture.sqlite
    .query(
      `INSERT INTO system_cli_login_codes
         (code_hash, account_id, created_at, expires_at)
       VALUES (?1, 'cli-session-account', ?2, ?3)`,
    )
    .run(codeHash, Math.min(now.getTime(), expiresAt - 1), expiresAt)
}

describe("POST /system/v1/cli-sessions", () => {
  test("exchanges a one-time code for a canonical System Session", async () => {
    const { client, fixture } = createFixture()
    await seedCode(fixture, "raw-cli-code")

    const response = await client.system.v1["cli-sessions"].$post({
      json: { code: "raw-cli-code" },
    })

    expect(response.status).toBe(201)
    const body = await response.json()
    if (!("account_id" in body)) throw new Error("expected issued System Session")
    expect(String(body.account_id)).toBe("cli-session-account")
    expect(body.access_token.length > 0).toBe(true)
    expect(body.refresh_token.length).toBe(64)
    expect(body.session_id.length > 0).toBe(true)
    expect(body.expires_at).toBe("2026-01-08T00:00:00.000Z")
    expect(fixture.sqlite.query("SELECT code_hash FROM system_cli_login_codes").all()).toEqual([])
    expect(
      fixture.sqlite.query("SELECT action, reason_code FROM system_audit_events").all(),
    ).toEqual([{ action: "auth.session.create", reason_code: null }])
  })

  test("consumes a code exactly once", async () => {
    const { client, fixture } = createFixture()
    await seedCode(fixture, "single-use-cli-code")

    const first = await client.system.v1["cli-sessions"].$post({
      json: { code: "single-use-cli-code" },
    })
    const second = await client.system.v1["cli-sessions"].$post({
      json: { code: "single-use-cli-code" },
    })

    expect(first.status).toBe(201)
    expect(second.status).toBe(401)
  })

  test("rejects an unknown, expired, or empty code", async () => {
    const unknown = createFixture()
    const expired = createFixture()
    const empty = createFixture()
    await seedCode(expired.fixture, "expired-cli-code", now.getTime() - 1)

    const unknownResponse = await unknown.client.system.v1["cli-sessions"].$post({
      json: { code: "unknown-cli-code" },
    })
    const expiredResponse = await expired.client.system.v1["cli-sessions"].$post({
      json: { code: "expired-cli-code" },
    })
    const emptyResponse = await empty.client.system.v1["cli-sessions"].$post({
      json: { code: "" },
    })

    expect(unknownResponse.status).toBe(401)
    expect(expiredResponse.status).toBe(401)
    expect(Number(emptyResponse.status)).toBe(400)
  })

  test("rejects when the System Account is suspended after code issuance", async () => {
    const { client, fixture } = createFixture()
    await seedCode(fixture, "suspended-account-code")
    fixture.sqlite.exec(`
      UPDATE system_accounts
      SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
      WHERE id = 'cli-session-account';
    `)

    const response = await client.system.v1["cli-sessions"].$post({
      json: { code: "suspended-account-code" },
    })

    expect(response.status).toBe(401)
    expect(fixture.sqlite.query("SELECT id FROM system_sessions").all()).toEqual([])
    expect(fixture.sqlite.query("SELECT action FROM system_audit_events").all()).toEqual([])
  })
})
