import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { SignJWT } from "jose"

const jwtSecret = "browser-code-route-jwt-secret"
const now = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600
const identityIssuer = "https://identity-provider.example"
const identityAudience = "https://api.example.com"
const identityKey = await createSystemIdentityTestKey("browser-code-access-key")

const codeResponseSchema = z.strictObject({
  code: z.string(),
  expires_in: z.number(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await seedCompanyEmployees(
    db,
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      deptId: employee.deptId,
      deptName: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )
  await seedIamForEmployees(db)
  await initializeStandardCompanyTestState(db)

  return db
}

function postBrowserCode(db: D1Database, token: string | null): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/system/browser-login-codes",
    token,
    method: "POST",
    body: {},
    now,
  })
}

async function createExternalToken(audience = identityAudience): Promise<string> {
  const issuedAt = Math.floor(new Date(now).getTime() / 1_000)

  return new SignJWT({
    email: "account@example.com",
    email_verified: true,
    name: "Example Account",
    client_id: "native-client",
    scope: "openid profile email offline_access",
  })
    .setProtectedHeader({ alg: "EdDSA", kid: identityKey.keyId, typ: "at+jwt" })
    .setIssuer(identityIssuer)
    .setAudience(audience)
    .setSubject("external-account-1")
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 300)
    .sign(identityKey.signingKey)
}

describe("POST /system/browser-login-codes", () => {
  test("returns 401 without a bearer token", async () => {
    const db = await createTestDb()

    const response = await postBrowserCode(db, null)

    expect(response.status).toBe(401)
  })

  test("issues a one-time code bound to the caller's session, stored only as a hash", async () => {
    const db = await createTestDb()
    const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })

    const response = await postBrowserCode(db, token)

    expect(response.status).toBe(201)
    const body = codeResponseSchema.parse(await response.json())
    expect(body.code.length > 0).toBe(true)
    expect(body.expires_in).toBe(60)

    const row = await db
      .prepare("SELECT code_hash, account_id, expires_at FROM system_browser_login_codes")
      .first<{
        code_hash: string
        account_id: string
        expires_at: number
      }>()

    const codeHash = await systemLoginCodeHash(body.code)
    if (codeHash instanceof Error) throw codeHash

    expect(row?.account_id).toBe("1")
    expect(row?.expires_at).toBe(nowEpoch * 1_000 + 60_000)
    // 生 code は保存されず、ハッシュのみが主キーとして残る。
    expect(row?.code_hash).toBe(codeHash)
    expect(row?.code_hash === body.code).toBe(false)
  })

  test("外部access tokenでも紐づくAccount本人のone-time codeを発行する", async () => {
    const db = await createTestDb()
    await db
      .prepare(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('oidc:external-account-1', '1', 'oidc', 'external-account-1', 0, 0, NULL)`,
      )
      .run()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/system/browser-login-codes",
      token: await createExternalToken(),
      method: "POST",
      body: {},
      now,
      identityAccessTokenIssuer: identityIssuer,
      identityAccessTokenAudience: identityAudience,
      identityJwks: identityKey.jwks,
    })

    expect(response.status).toBe(201)
    const body = codeResponseSchema.parse(await response.json())
    const row = await db
      .prepare("SELECT account_id FROM system_browser_login_codes")
      .first<{ account_id: string }>()

    expect(body.expires_in).toBe(60)
    expect(row?.account_id).toBe("1")
  })

  test("別API向けの外部access tokenではone-time codeを発行しない", async () => {
    const db = await createTestDb()

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/system/browser-login-codes",
      token: await createExternalToken("https://other-api.example.com"),
      method: "POST",
      body: {},
      now,
      identityAccessTokenIssuer: identityIssuer,
      identityAccessTokenAudience: identityAudience,
      identityJwks: identityKey.jwks,
    })

    expect(response.status).toBe(401)
    const count = await db
      .prepare("SELECT COUNT(*) AS count FROM system_browser_login_codes")
      .first<number>("count")
    expect(count).toBe(0)
  })
})
