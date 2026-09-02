import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { describe, expect, test } from "bun:test"
import { SignJWT } from "jose"

const jwtSecret = "verify-bearer-test-secret"
const identityIssuer = "https://identity-broker.example"
const accessTokenIssuer = "https://identity-provider.example"
const audience = "https://api.example.com"
const now = "2026-01-01T00:00:00.000Z"
const identityKey = await createSystemIdentityTestKey("external-access-key")
const untrustedIdentityKey = await createSystemIdentityTestKey("untrusted-access-key")

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await initializeStandardCompanyTestState(db)
  await db
    .prepare(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('oidc:employee-5', '5', 'oidc', 'external-subject-5', 0, 0, NULL)`,
    )
    .run()

  return db
}

function externalToken(
  overrides: {
    audience?: string
    subject?: string
    type?: string
    emailVerified?: boolean
    untrustedKey?: boolean
  } = {},
): Promise<string> {
  const issuedAt = Math.floor(new Date(now).getTime() / 1_000)
  const key = overrides.untrustedKey === true ? untrustedIdentityKey : identityKey

  return new SignJWT({
    email: "you+e005@example.com",
    email_verified: overrides.emailVerified ?? true,
    name: "Emery Lane",
    client_id: "native-client",
    scope: "openid profile email offline_access",
  })
    .setProtectedHeader({
      alg: "EdDSA",
      kid: key.keyId,
      typ: overrides.type ?? "at+jwt",
    })
    .setIssuer(accessTokenIssuer)
    .setAudience(overrides.audience ?? audience)
    .setSubject(overrides.subject ?? "external-subject-5")
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 300)
    .sign(key.signingKey)
}

function externalRequest(props: { db: D1Database; token: string }): Promise<Response> {
  return requestWithContext({
    db: props.db,
    jwtSecret,
    path: "/company/current-profile",
    token: props.token,
    now,
    identityIssuer,
    identityAccessTokenIssuer: accessTokenIssuer,
    identityAccessTokenAudience: audience,
    identityJwks: identityKey.jwks,
  })
}

describe("verifyBearer", () => {
  test("外部IdPのresource-bound access tokenを既存Identity bindingへ接続する", async () => {
    const response = await externalRequest({
      db: await createTestDb(),
      token: await externalToken(),
    })

    expect(response.status).toBe(200)
  })

  test("access token専用issuer未設定なら従来のidentity issuerを使う", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company/current-profile",
      token: await externalToken(),
      now,
      identityIssuer: accessTokenIssuer,
      identityAccessTokenAudience: audience,
      identityJwks: identityKey.jwks,
    })

    expect(response.status).toBe(200)
  })

  test("別resource向けの外部access tokenを拒否する", async () => {
    const response = await externalRequest({
      db: await createTestDb(),
      token: await externalToken({ audience: "https://other-api.example.com" }),
    })

    expect(response.status).toBe(401)
  })

  test("ID tokenをAPI access tokenとして受理しない", async () => {
    const response = await externalRequest({
      db: await createTestDb(),
      token: await externalToken({ type: "JWT" }),
    })

    expect(response.status).toBe(401)
  })

  test("未検証emailを持つaccess tokenを拒否する", async () => {
    const response = await externalRequest({
      db: await createTestDb(),
      token: await externalToken({ emailVerified: false }),
    })

    expect(response.status).toBe(401)
  })

  test("信頼していない鍵で署名されたaccess tokenを拒否する", async () => {
    const response = await externalRequest({
      db: await createTestDb(),
      token: await externalToken({ untrustedKey: true }),
    })

    expect(response.status).toBe(401)
  })

  test("activeなIdentity bindingが無いsubjectを拒否する", async () => {
    const response = await externalRequest({
      db: await createTestDb(),
      token: await externalToken({ subject: "unknown-subject" }),
    })

    expect(response.status).toBe(401)
  })

  test("外部IdP未設定でも従来のSystem sessionを受理する", async () => {
    const db = await createTestDb()
    const token = await createTestToken(jwtSecret, {
      employeeId: toWorkforceEmployeeId(5),
    })
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/company/current-profile",
      token,
      // 従来sessionの有効期限判定はリクエスト文脈の業務時刻ではなく実時刻を使う。
      now,
    })

    expect(response.status).toBe(200)
  })

  test("access token audience未設定なら直接受理経路だけを無効にする", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: "/company/current-profile",
      token: await externalToken(),
      now,
      identityIssuer: accessTokenIssuer,
      identityJwks: identityKey.jwks,
    })

    expect(response.status).toBe(401)
  })
})
