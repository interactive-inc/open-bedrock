import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemHTTPException } from "@system/interface/errors"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.step-up-grants"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { createSystemIdentityToken } from "@system/test/create-system-identity-token.test-support"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

const now = new Date("2026-01-01T00:00:00.000Z")
const nowEpoch = Math.floor(now.getTime() / 1_000)
const identityKey = await createSystemIdentityTestKey("step-up-key")
const identityIssuer = "https://identity-provider.example/"
const identityAudience = "urn:system:identity-login"
const accountId = zAccountId.parse("external-step-up-account")
const subject = "external-step-up-subject"
const jwtSecret = "external-step-up-jwt-secret"

describe("POST /system/step-up-grants", () => {
  test("freshな外部Identity tokenを現在のAccountへ束縛し、replayと古いtokenを拒否する", async () => {
    const fixture = new SystemSessionTestContext()
    seedIdentity(fixture)
    const accessToken = await issueAccessToken(fixture)
    if (accessToken instanceof Error) throw accessToken
    const app = createApp(fixture, accessToken)
    const client = app.client
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "external-step-up-fresh",
      keyId: identityKey.keyId,
      audience: identityAudience,
    })

    const issued = await client.system["step-up-grants"].$post({
      json: { method: "external_identity", token },
    })
    expect({ status: issued.status, body: await issued.json() }).toMatchObject({
      status: 201,
      body: {
        method: "external_identity",
        expires_at: "2026-01-01T00:05:00.000Z",
      },
    })
    const replay = await client.system["step-up-grants"].$post({
      json: { method: "external_identity", token },
    })
    expect(Number(replay.status)).toBe(401)

    const staleToken = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "external-step-up-stale",
      keyId: identityKey.keyId,
      iat: nowEpoch - 301,
      exp: nowEpoch + 60,
      audience: identityAudience,
    })
    const stale = await client.system["step-up-grants"].$post({
      json: { method: "external_identity", token: staleToken },
    })
    expect(Number(stale.status)).toBe(401)
    expect(
      fixture.sqlite
        .query(
          `SELECT count(*) AS total FROM system_audit_events
           WHERE action = 'auth.step_up.issued'`,
        )
        .get(),
    ).toEqual({ total: 1 })
  })
})

function createApp(fixture: SystemSessionTestContext, accessToken: string) {
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/step-up-grants", ...POST)
  app.onError((error, context) => {
    if (!(error instanceof SystemHTTPException)) throw error
    return context.json({ code: error.code, detail: error.detail }, error.status)
  })
  const request = (
    input: Parameters<typeof app.request>[0],
    init?: Parameters<typeof app.request>[1],
  ) =>
    app.request(input, init, {
      DB: fixture.context.env.DB,
      JWT_SECRET: jwtSecret,
      IDENTITY_JWKS: identityKey.jwks,
      IDENTITY_ISSUER: identityIssuer,
      IDENTITY_AUDIENCE: identityAudience,
    })
  return {
    client: hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  }
}

function seedIdentity(fixture: SystemSessionTestContext): void {
  fixture.sqlite
    .query(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`,
    )
    .run(accountId, now.getTime())
  fixture.sqlite
    .query(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('external-step-up-identity', ?1, 'oidc', ?2, ?3, ?3, NULL)`,
    )
    .run(accountId, subject, now.getTime())
}

async function issueAccessToken(fixture: SystemSessionTestContext): Promise<string | Error> {
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) return applications
  const issued = await applications.issue.execute({
    accountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (issued instanceof Error || issued.kind === "rejected") {
    return issued instanceof Error ? issued : new Error(issued.reason)
  }
  return issued.accessToken
}
