import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import type { SystemHonoEnv } from "@system/interface/http/system-factory"
import { GET } from "@system/interface/routes/system.v1.cli-authorization-callback"
import { createSystemIdentityTestKey } from "@system/infrastructure/identity/create-system-identity-test-key.test-support"
import { createSystemIdentityToken } from "@system/infrastructure/identity/create-system-identity-token.test-support"
import { afterEach, describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

const identityKey = await createSystemIdentityTestKey()
const wrongIdentityKey = await createSystemIdentityTestKey("wrong-key")
const identityIssuer = "https://identity-provider.example/"
const apiOrigin = "https://api.example.com"
const now = new Date("2026-01-01T00:00:00.000Z")
const nowEpoch = Math.floor(now.getTime() / 1_000)
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function createFixture(
  configuration: Readonly<{ issuer?: string; jwks?: string; apiOrigin?: string }> = Object.freeze({
    issuer: identityIssuer,
    jwks: identityKey.jwks,
    apiOrigin,
  }),
) {
  const fixture = new SystemSessionTestContext()
  fixture.sqlite.exec(`
    INSERT INTO system_accounts
      (id, status, token_version, created_at, updated_at)
    VALUES ('cli-account', 'active', 0, ${now.getTime()}, ${now.getTime()});
    INSERT INTO system_identity_bindings
      (id, account_id, provider, subject, created_at, activated_at, revoked_at)
    VALUES (
      'cli-identity', 'cli-account', 'oidc', 'cli-subject',
      ${now.getTime()}, ${now.getTime()}, NULL
    );
  `)
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .get("/system/v1/cli-authorization-callback", ...GET)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        IDENTITY_ISSUER: configuration.issuer,
        IDENTITY_JWKS: configuration.jwks,
        API_ORIGIN: configuration.apiOrigin,
      }),
  })

  return Object.freeze({ client, fixture })
}

function seedAuthorizationState(
  fixture: SystemSessionTestContext,
  state: string,
  port = 51_820,
): void {
  fixture.sqlite
    .query(
      `INSERT INTO system_cli_login_states
         (state, port, cli_state, code_verifier, created_at, expires_at)
       VALUES (?1, ?2, 'cli-opaque-state', ?3, ?4, ?5)`,
    )
    .run(state, port, "a".repeat(43), now.getTime(), now.getTime() + 600_000)
}

function mockIdentityExchange(token: string): void {
  const exchange = async () =>
    new Response(JSON.stringify({ id_token: token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  exchange.preconnect = originalFetch.preconnect
  globalThis.fetch = exchange
}

describe("GET /system/v1/cli-authorization-callback", () => {
  test("resolves a System Identity and redirects to loopback with an opaque one-time code", async () => {
    const { client, fixture } = createFixture()
    seedAuthorizationState(fixture, "broker-state-success")
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "cli-subject",
      jti: "cli-callback-success",
      issuer: identityIssuer,
      audience: apiOrigin,
    })
    mockIdentityExchange(token)

    const response = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code", state: "broker-state-success" },
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(`${url.origin}${url.pathname}`).toBe("http://127.0.0.1:51820/callback")
    expect(url.searchParams.get("state")).toBe("cli-opaque-state")
    const rawCode = url.searchParams.get("code")
    expect(rawCode).not.toBeNull()
    expect(url.searchParams.get("error")).toBeNull()
    const persisted = fixture.sqlite
      .query("SELECT code_hash, account_id FROM system_cli_login_codes")
      .get()
    expect(persisted).toEqual({
      code_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      account_id: "cli-account",
    })
    expect(JSON.stringify(persisted)).not.toContain(rawCode)
    expect(fixture.sqlite.query("SELECT id FROM system_sessions").all()).toEqual([])
    expect(fixture.sqlite.query("SELECT action FROM system_audit_events").all()).toEqual([])
  })

  test("does not auto-provision an unknown Identity or mutate Company state", async () => {
    const { client, fixture } = createFixture()
    seedAuthorizationState(fixture, "broker-state-unknown")
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "unknown-subject",
      jti: "cli-callback-unknown",
      issuer: identityIssuer,
      audience: apiOrigin,
    })
    mockIdentityExchange(token)

    const response = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code", state: "broker-state-unknown" },
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    expect(new URL(location).searchParams.get("error")).toBe("identity_login_denied")
    expect(fixture.sqlite.query("SELECT id FROM system_accounts ORDER BY id").all()).toEqual([
      { id: "cli-account" },
    ])
    expect(fixture.sqlite.query("SELECT code_hash FROM system_cli_login_codes").all()).toEqual([])
    expect(
      fixture.sqlite.query("SELECT action, reason_code FROM system_audit_events").all(),
    ).toEqual([{ action: "auth.session.cli_login_denied", reason_code: "account_not_found" }])
  })

  test("rejects an invalid Identity token and records only the System denial", async () => {
    const { client, fixture } = createFixture()
    seedAuthorizationState(fixture, "broker-state-invalid-token")
    const token = await createSystemIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      sub: "cli-subject",
      jti: "cli-callback-invalid-token",
      issuer: identityIssuer,
      audience: apiOrigin,
      keyId: wrongIdentityKey.keyId,
    })
    mockIdentityExchange(token)

    const response = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code", state: "broker-state-invalid-token" },
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    expect(new URL(location).searchParams.get("error")).toBe("identity_login_denied")
    expect(
      fixture.sqlite.query("SELECT action, reason_code FROM system_audit_events").all(),
    ).toEqual([{ action: "auth.session.cli_login_denied", reason_code: "invalid_token" }])
  })

  test("consumes broker state once and rejects missing, unknown, or reused state", async () => {
    const { client, fixture } = createFixture()
    seedAuthorizationState(fixture, "broker-state-single-use")
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "cli-subject",
      jti: "cli-callback-single-use",
      issuer: identityIssuer,
      audience: apiOrigin,
    })
    mockIdentityExchange(token)

    const missing = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code" },
    })
    const unknown = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code", state: "unknown-state" },
    })
    const first = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code", state: "broker-state-single-use" },
    })
    const reused = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code", state: "broker-state-single-use" },
    })

    expect(Number(missing.status)).toBe(401)
    expect(Number(unknown.status)).toBe(401)
    expect(first.status).toBe(302)
    expect(Number(reused.status)).toBe(401)
  })

  test("fails closed when System audit cannot record a denial", async () => {
    const { client, fixture } = createFixture()
    seedAuthorizationState(fixture, "broker-state-audit-failure")
    fixture.sqlite.exec(`
      CREATE TRIGGER reject_system_audit_insert
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(ABORT, 'forced audit insert failure');
      END;
    `)
    const token = await createSystemIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      sub: "cli-subject",
      jti: "cli-callback-audit-failure",
      issuer: identityIssuer,
      audience: apiOrigin,
      keyId: wrongIdentityKey.keyId,
    })
    mockIdentityExchange(token)

    const response = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code", state: "broker-state-audit-failure" },
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    expect(new URL(location).searchParams.get("error")).toBe("audit_unavailable")
    expect(fixture.sqlite.query("SELECT code_hash FROM system_cli_login_codes").all()).toEqual([])
    expect(fixture.sqlite.query("SELECT action FROM system_audit_events").all()).toEqual([])
  })

  test("returns a loopback failure when callback configuration is unavailable", async () => {
    const { client, fixture } = createFixture(Object.freeze({}))
    seedAuthorizationState(fixture, "broker-state-unconfigured")

    const response = await client.system.v1["cli-authorization-callback"].$get({
      query: { code: "broker-code", state: "broker-state-unconfigured" },
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    expect(new URL(location).searchParams.get("error")).toBe("cli_login_unavailable")
  })
})
