import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import { OidcCryptographyService } from "@system/infrastructure/identity/oidc-cryptography.service"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { systemFactory } from "@system/interface/http/system-factory"
import { POST } from "@system/interface/routes/oauth.token"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { hc } from "hono/client"
import { exportJWK, generateKeyPair } from "jose"

const now = new Date("2026-01-01T00:00:00.000Z")
const issuer = "https://identity.example.test"
const clientId = "system-console"
const redirectUri = "https://console.example.test/callback"
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

async function createSigningKeys(): Promise<string> {
  const generated = await generateKeyPair("ES256", { extractable: true })
  const key = await exportJWK(generated.privateKey)

  if (key.x === undefined || key.y === undefined || key.d === undefined) {
    throw new Error("test OIDC key is incomplete")
  }

  return JSON.stringify({
    active: {
      kty: "EC",
      crv: "P-256",
      x: key.x,
      y: key.y,
      d: key.d,
      kid: "test-key",
      use: "sig",
      alg: "ES256",
    },
    previous: [],
  })
}

describe("POST /oauth/token", () => {
  test("canonical Account・Identity・OIDC storageからtokenを発行してSystem監査を残す", async () => {
    const fixture = new SystemSessionTestContext()
    const code = OidcCryptographyService.createSecret()
    const codeHash = await OidcCryptographyService.hashSecret(code)
    const codeChallenge = await OidcCryptographyService.createPkceChallenge(verifier)
    fixture.sqlite
      .query(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES ('account-1', 'active', 0, ?1, ?1)`,
      )
      .run(now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('identity-1', 'account-1', 'password', 'person@example.com', ?1, ?1, NULL)`,
      )
      .run(now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_identity_profiles
           (identity_id, email, email_verified, last_used_at, updated_at)
         VALUES ('identity-1', 'person@example.com', 1, ?1, ?1)`,
      )
      .run(now.getTime())
    fixture.sqlite
      .query(
        `INSERT INTO system_oidc_authorization_codes
           (code_hash, issuer, client_id, redirect_uri, account_id, code_challenge,
            nonce, scope, expires_at, created_at)
         VALUES (?1, ?2, ?3, ?4, 'account-1', ?5, 'nonce-with-enough-entropy',
                 'openid profile email', ?6, ?7)`,
      )
      .run(
        codeHash,
        issuer,
        clientId,
        redirectUri,
        codeChallenge,
        now.getTime() + 120_000,
        now.getTime(),
      )

    const database = drizzle(fixture.context.env.DB, { schema: systemCoreSchema })
    const signingKeys = await createSigningKeys()
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("database", database)
        context.set("now", () => now)
        context.set("oidcClientRegistry", {
          [issuer]: [{ id: clientId, name: "System Console", redirectUris: [redirectUri] }],
        })
        context.set("oidcIssuerConfiguration", {
          issuersByHostname: { "identity.example.test": issuer },
          localProxyHostnames: [],
          localIssuerHostname: null,
        })
        await next()
      })
      .post("/oauth/token", ...POST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        OIDC_SIGNING_KEYS: signingKeys,
      })
    const client = hc<typeof app>(issuer, { fetch: request })
    const response = await client.oauth.token.$post({
      form: {
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      token_type: "Bearer",
      expires_in: 300,
      scope: "openid profile email",
    })
    expect(
      fixture.sqlite.query("SELECT count(*) AS total FROM system_oidc_access_tokens").get(),
    ).toEqual({ total: 1 })
    expect(fixture.sqlite.query("SELECT action, outcome FROM system_audit_events").get()).toEqual({
      action: "auth.oidc.token_exchange",
      outcome: "succeeded",
    })
    fixture.sqlite.close()
  })
})
