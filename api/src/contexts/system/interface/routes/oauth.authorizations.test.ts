import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/oauth.authorizations"
import { describe, expect, test } from "bun:test"
import { OidcIssuerConfigurationValue } from "@system/domain/values/oauth/oidc-issuer-configuration.value"
import { OidcClientRegistryValue } from "@system/domain/values/oauth/oidc-client-registry.value"
import { drizzle } from "drizzle-orm/d1"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const issuer = "https://identity.example.test"
const clientId = "system-console"
const redirectUri = "https://console.example.test/callback"

function createOidcClientRegistry(): OidcClientRegistryValue {
  const registry = OidcClientRegistryValue.restore({
    [issuer]: [{ id: clientId, name: "System Console", redirectUris: [redirectUri] }],
  })
  if (registry instanceof Error) throw registry
  return registry
}

describe("POST /oauth/authorizations", () => {
  test("認証済みAccountの同意をcanonical codeとSystem監査へ記録する", async () => {
    const fixture = new SystemSessionTestContext()
    fixture.sqlite.exec("INSERT INTO system_accounts VALUES ('account-1', 'active', 0, 0, 0)")
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("database", drizzle(fixture.context.env.DB, { schema: systemCoreSchema }))
        context.set("now", () => now)
        context.set("userId", "account-1")
        context.set("accountTokenVersion", 0)
        context.set("role", "system:root")
        context.set("permissions", new Set(["system:admin"]))
        context.set("oidcClientRegistry", createOidcClientRegistry())
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
      .post("/oauth/authorizations", ...POST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, { DB: fixture.context.env.DB })
    const client = hc<typeof app>(issuer, { fetch: request })
    const response = await client.oauth.authorizations.$post({
      json: {
        decision: "allow",
        responseType: "code",
        clientId,
        redirectUri,
        scope: "openid email",
        state: "state-with-enough-entropy",
        nonce: "nonce-with-enough-entropy",
        codeChallenge: "a".repeat(43),
        codeChallengeMethod: "S256",
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("pragma")).toBe("no-cache")
    const body = await response.json()
    if (
      typeof body !== "object" ||
      body === null ||
      !("redirect_uri" in body) ||
      typeof body.redirect_uri !== "string"
    ) {
      throw new Error("OIDC authorization response is invalid")
    }
    expect(body.redirect_uri.startsWith(`${redirectUri}?`)).toBe(true)
    expect(new URL(body.redirect_uri).searchParams.get("code")).toHaveLength(43)
    expect(
      fixture.sqlite.query("SELECT account_id FROM system_oidc_authorization_codes").get(),
    ).toEqual({ account_id: "account-1" })
    expect(fixture.sqlite.query("SELECT action, outcome FROM system_audit_events").get()).toEqual({
      action: "auth.oidc.authorization",
      outcome: "succeeded",
    })

    const deniedResponse = await client.oauth.authorizations.$post({
      json: {
        decision: "deny",
        responseType: "code",
        clientId,
        redirectUri,
        scope: "openid email",
        state: "second-state-with-enough-entropy",
        nonce: "second-nonce-with-enough-entropy",
        codeChallenge: "b".repeat(43),
        codeChallengeMethod: "S256",
      },
    })

    expect(deniedResponse.status).toBe(200)
    const deniedBody = await deniedResponse.json()
    if (
      typeof deniedBody !== "object" ||
      deniedBody === null ||
      !("redirect_uri" in deniedBody) ||
      typeof deniedBody.redirect_uri !== "string"
    ) {
      throw new Error("OIDC denial response is invalid")
    }
    const deniedRedirect = new URL(deniedBody.redirect_uri)
    expect(deniedRedirect.searchParams.get("error")).toBe("access_denied")
    expect(deniedRedirect.searchParams.get("code")).toBeNull()
    expect(
      fixture.sqlite.query("SELECT count(*) AS total FROM system_oidc_authorization_codes").get(),
    ).toEqual({ total: 1 })
    expect(
      fixture.sqlite
        .query("SELECT action, outcome, reason_code FROM system_audit_events ORDER BY rowid")
        .all(),
    ).toEqual([
      {
        action: "auth.oidc.authorization",
        outcome: "succeeded",
        reason_code: null,
      },
      {
        action: "auth.oidc.authorization",
        outcome: "denied",
        reason_code: "user_denied",
      },
    ])
    fixture.sqlite.close()
  })
})
