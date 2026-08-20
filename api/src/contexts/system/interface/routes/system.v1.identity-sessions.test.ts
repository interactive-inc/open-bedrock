import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import type { SystemHonoEnv } from "@system/interface/http/system-factory"
import { POST } from "@system/interface/routes/system.v1.identity-sessions"
import { createSystemIdentityTestKey } from "@system/infrastructure/identity/create-system-identity-test-key.test-support"
import { createSystemIdentityToken } from "@system/infrastructure/identity/create-system-identity-token.test-support"
import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

const jwtSecret = "identity-session-route-jwt-secret"
const identityKey = await createSystemIdentityTestKey()
const wrongIdentityKey = await createSystemIdentityTestKey("wrong-key")
const identityIssuer = "https://identity-provider.example/"
const identityAudience = "urn:system:identity-login"
const now = new Date("2026-01-01T00:00:00.000Z")
const nowEpoch = Math.floor(now.getTime() / 1_000)
const accountId = "identity-session-account"
const subject = "external-subject-1"

function createFixture(
  configuration: Readonly<{
    jwks?: string
    issuer?: string
    audience?: string
  }> = Object.freeze({
    jwks: identityKey.jwks,
    issuer: identityIssuer,
    audience: identityAudience,
  }),
) {
  const fixture = new SystemSessionTestContext()
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`,
    )
    .run(accountId, now.getTime())
  fixture.sqlite
    .query(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('external-identity', ?1, 'oidc', ?2, ?3, ?3, NULL)`,
    )
    .run(accountId, subject, now.getTime())

  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/v1/identity-sessions", ...POST)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        IDENTITY_JWKS: configuration.jwks,
        IDENTITY_ISSUER: configuration.issuer,
        IDENTITY_AUDIENCE: configuration.audience,
      }),
  })

  return Object.freeze({ client, fixture })
}

describe("POST /system/v1/identity-sessions", () => {
  test("issues a canonical System Session without any Company records", async () => {
    const { client, fixture } = createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-success",
      audience: identityAudience,
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(201)
    const body = await response.json()
    if (!("account_id" in body)) throw new Error("expected issued System Session")
    expect(body.account_id).toBe(accountId)
    expect(body.access_token.length > 0).toBe(true)
    expect(body.refresh_token.length).toBe(64)
    expect(body.session_id.length > 0).toBe(true)
    expect(body.expires_at).toBe("2026-01-08T00:00:00.000Z")
    expect(
      fixture.sqlite
        .query("SELECT action, reason_code FROM system_audit_events ORDER BY rowid")
        .all(),
    ).toEqual([{ action: "auth.session.create", reason_code: null }])
    expect(
      fixture.sqlite.query("SELECT jti FROM system_identity_login_tokens ORDER BY jti").all(),
    ).toEqual([{ jti: "identity-session-success" }])
  })

  test("rejects a token with an invalid signature and records the denial in System audit", async () => {
    const { client, fixture } = createFixture()
    const token = await createSystemIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-invalid-signature",
      keyId: wrongIdentityKey.keyId,
      audience: identityAudience,
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: "identity login denied",
      code: "identity_login_denied",
    })
    expect(
      fixture.sqlite
        .query("SELECT action, reason_code FROM system_audit_events ORDER BY rowid")
        .all(),
    ).toEqual([{ action: "auth.session.identity_login_denied", reason_code: "invalid_token" }])
  })

  test("rejects a token whose issuer does not match", async () => {
    const { client, fixture } = createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-invalid-issuer",
      issuer: "https://attacker.example/",
      audience: identityAudience,
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(401)
    expect(
      fixture.sqlite.query("SELECT reason_code FROM system_audit_events ORDER BY rowid").all(),
    ).toEqual([{ reason_code: "invalid_token" }])
  })

  test("rejects a token whose audience does not match", async () => {
    const { client, fixture } = createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-invalid-audience",
      audience: "urn:another-system",
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(401)
    expect(
      fixture.sqlite.query("SELECT reason_code FROM system_audit_events ORDER BY rowid").all(),
    ).toEqual([{ reason_code: "invalid_token" }])
  })

  test("rejects an expired token", async () => {
    const { client, fixture } = createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch - 120, {
      sub: subject,
      jti: "identity-session-expired",
      iat: nowEpoch - 120,
      exp: nowEpoch - 60,
      audience: identityAudience,
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(401)
    expect(
      fixture.sqlite.query("SELECT reason_code FROM system_audit_events ORDER BY rowid").all(),
    ).toEqual([{ reason_code: "invalid_token" }])
  })

  test("rejects an unverified email", async () => {
    const { client, fixture } = createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-unverified-email",
      emailVerified: false,
      audience: identityAudience,
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(401)
    expect(
      fixture.sqlite.query("SELECT reason_code FROM system_audit_events ORDER BY rowid").all(),
    ).toEqual([{ reason_code: "email_unverified" }])
  })

  test("does not disclose whether an Identity or Account exists", async () => {
    const { client, fixture } = createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "unknown-subject",
      jti: "identity-session-unknown-account",
      audience: identityAudience,
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: "identity login denied",
      code: "identity_login_denied",
    })
    expect(
      fixture.sqlite.query("SELECT reason_code FROM system_audit_events ORDER BY rowid").all(),
    ).toEqual([{ reason_code: "account_not_found" }])
  })

  test("rejects a suspended System Account without consulting Company", async () => {
    const { client, fixture } = createFixture()
    fixture.sqlite
      .query(
        `UPDATE system_accounts
         SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = ?1`,
      )
      .run(accountId)
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-suspended-account",
      audience: identityAudience,
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(401)
    expect(
      fixture.sqlite.query("SELECT reason_code FROM system_audit_events ORDER BY rowid").all(),
    ).toEqual([{ reason_code: "account_inactive" }])
  })

  test("rejects replay of the same external token", async () => {
    const { client, fixture } = createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-replay",
      audience: identityAudience,
    })

    const first = await client.system.v1["identity-sessions"].$post({ json: { token } })
    const second = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(first.status).toBe(201)
    expect(second.status).toBe(401)
    expect(
      fixture.sqlite
        .query("SELECT action, reason_code FROM system_audit_events ORDER BY rowid")
        .all(),
    ).toEqual([
      { action: "auth.session.create", reason_code: null },
      { action: "auth.session.identity_login_denied", reason_code: "token_replayed" },
    ])
  })

  test("returns unavailable when external Identity configuration is missing", async () => {
    const { client, fixture } = createFixture(Object.freeze({}))
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-not-configured",
      audience: identityAudience,
    })

    const response = await client.system.v1["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: "identity login is unavailable",
      code: "identity_login_unavailable",
    })
    expect(fixture.sqlite.query("SELECT action FROM system_audit_events").all()).toEqual([])
  })
})
