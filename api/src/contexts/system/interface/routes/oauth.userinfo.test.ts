import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { OidcIssuerConfigurationValue } from "@system/domain/values/oauth/oidc-issuer-configuration.value"
import { createOidcSecret } from "@system/infrastructure/identity/create-oidc-secret.repository"
import { hashOidcSecret } from "@system/infrastructure/identity/hash-oidc-secret.repository"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { OIDCHTTPException } from "@system/interface/errors"
import { GET } from "@system/interface/routes/oauth.userinfo"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const issuer = "https://identity.example.test"

describe("GET /oauth/userinfo", () => {
  test("canonical AccountとIdentity profileだけからclaimを返す", async () => {
    const fixture = new SystemSessionTestContext()
    const accessToken = createOidcSecret()
    const tokenHash = await hashOidcSecret(accessToken)
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
        `INSERT INTO system_oidc_access_tokens
           (token_hash, issuer, client_id, account_id, scope, expires_at, created_at)
         VALUES (?1, ?2, 'system-console', 'account-1', 'openid email', ?3, ?4)`,
      )
      .run(tokenHash, issuer, now.getTime() + 300_000, now.getTime())

    const database = drizzle(fixture.context.env.DB, { schema: systemCoreSchema })
    const app = systemFactory
      .createApp()
      .onError((error, context) => {
        if (!(error instanceof OIDCHTTPException)) throw error
        if (error.authenticate !== null) {
          context.header("WWW-Authenticate", error.authenticate)
        }
        return context.body(null, error.status)
      })
      .use("*", async (context, next) => {
        context.set("database", database)
        context.set("now", () => now)
        context.set(
          "oidcIssuerConfiguration",
          new OidcIssuerConfigurationValue({
            issuersByHostname: { "identity.example.test": issuer },
            localProxyHostnames: [],
            localIssuerHostname: null,
          }),
        )
        await next()
      })
      .get("/oauth/userinfo", ...GET)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, { DB: fixture.context.env.DB })
    const client = hc<typeof app>(issuer, { fetch: request })
    const response = await client.oauth.userinfo.$get({
      header: { authorization: `Bearer ${accessToken}` },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("pragma")).toBe("no-cache")
    expect(await response.json()).toEqual({
      sub: "account-1",
      email: "person@example.com",
      email_verified: true,
    })
    fixture.sqlite.close()
  })

  test("suspended Accountの有効期限内tokenも拒否する", async () => {
    const fixture = new SystemSessionTestContext()
    const accessToken = createOidcSecret()
    const tokenHash = await hashOidcSecret(accessToken)
    fixture.sqlite.exec(`
      INSERT INTO system_accounts VALUES ('account-1', 'suspended', 1, 0, 1);
      INSERT INTO system_oidc_access_tokens
        (token_hash, issuer, client_id, account_id, scope, expires_at, created_at)
        VALUES (
          '${tokenHash}',
          '${issuer}',
          'system-console',
          'account-1',
          'openid',
          ${now.getTime() + 300_000},
          ${now.getTime()}
        );
    `)

    const database = drizzle(fixture.context.env.DB, { schema: systemCoreSchema })
    const app = systemFactory
      .createApp()
      .onError((error, context) => {
        if (!(error instanceof OIDCHTTPException)) throw error
        if (error.authenticate !== null) {
          context.header("WWW-Authenticate", error.authenticate)
        }
        return context.body(null, error.status)
      })
      .use("*", async (context, next) => {
        context.set("database", database)
        context.set("now", () => now)
        context.set(
          "oidcIssuerConfiguration",
          new OidcIssuerConfigurationValue({
            issuersByHostname: { "identity.example.test": issuer },
            localProxyHostnames: [],
            localIssuerHostname: null,
          }),
        )
        await next()
      })
      .get("/oauth/userinfo", ...GET)
    const response = await app.request(
      "/oauth/userinfo",
      { headers: { authorization: `Bearer ${accessToken}` } },
      { DB: fixture.context.env.DB },
    )

    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toBe('Bearer error="invalid_token"')
    fixture.sqlite.close()
  })
})
