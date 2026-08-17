import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { createIdentityTestKey } from "@/lib/auth/test/create-identity-test-key"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createIdentityToken } from "@/lib/auth/test/create-identity-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "identity-login-route-jwt-secret"
const identityKey = await createIdentityTestKey()
const wrongIdentityKey = await createIdentityTestKey("wrong-key")
const identityIssuer = "https://identity-provider.example/"
const identityAudience = "open-karte"
const provisioningApiKey = "identity-login-route-provisioning-key"
const now = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600

const tokenResponseSchema = z.strictObject({
  access_token: z.string(),
  refresh_token: z.string(),
})

/** account.id=employee.id で seed 済みのアカウントへ oidc identity を 1 件足す。 */
async function seedExternalIdentity(
  db: D1Database,
  accountId: number,
  subject: string,
  email: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO identities (account_id, provider, subject, secret, email, email_verified, created_at)
       VALUES (?1, 'oidc', ?2, NULL, ?3, 1, 0)`,
    )
    .bind(accountId, subject, email)
    .run()
}

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )
  await seedIamForEmployees(db)
  // E001(admin) に外部 identity を紐付ける。
  await seedExternalIdentity(db, 1, "external-subject-1", "you+e001@example.com")
  return db
}

async function postIdentityLogin(
  db: D1Database,
  token: string,
  overrides: {
    identityJwks?: string
    identityIssuer?: string
    identityAudience?: string
  } = {},
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/auth/identity/login",
    token: null,
    method: "POST",
    body: { token },
    now,
    identityJwks: overrides.identityJwks ?? identityKey.jwks,
    identityIssuer: overrides.identityIssuer ?? identityIssuer,
    identityAudience: overrides.identityAudience ?? identityAudience,
  })
}

/** 外部 IdP からのプロビジョニング(POST /provisioning/identities)を実エンドポイント経由で叩く。 */
async function postProvisioning(db: D1Database, body: unknown): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/provisioning/identities",
    token: null,
    method: "POST",
    body,
    headers: { Authorization: `Bearer ${provisioningApiKey}` },
    now,
    provisioningApiKey,
  })
}

async function auditRows(
  db: D1Database,
): Promise<Array<{ action: string; reason_code: string | null }>> {
  return (
    await db
      .prepare("SELECT action, reason_code FROM audit_events ORDER BY id")
      .all<{ action: string; reason_code: string | null }>()
  ).results
}

async function systemAuditRows(
  db: D1Database,
): Promise<Array<{ action: string; reason_code: string | null }>> {
  return (
    await db
      .prepare("SELECT action, reason_code FROM system_audit_events ORDER BY occurred_at, event_id")
      .all<{ action: string; reason_code: string | null }>()
  ).results
}

describe("POST /auth/identity/login", () => {
  test("issues tokens for a provisioned external identity", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      jti: "login-jti-1",
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(200)
    const body = tokenResponseSchema.parse(await response.json())
    expect(body.access_token.length > 0).toBe(true)
    expect(body.refresh_token.length > 0).toBe(true)

    const rows = await systemAuditRows(db)
    expect(rows).toEqual([{ action: "auth.session.identity_login_succeeded", reason_code: null }])

    // jti が使用済みとして記録されている。
    const jti = await db
      .prepare("SELECT jti FROM identity_login_tokens WHERE jti = 'login-jti-1'")
      .first<string>("jti")
    expect(jti).toBe("login-jti-1")
  })

  // regression: 外部プロビジョニングで作られた従業員は社員コードを持たない(code=NULL)。
  // 認証パスが code=NULL の行を Employee として読み戻す際、entity の zod parse が
  // 非 null を要求していたため login が 500(unexpected)で失敗していた。provision→login を
  // 1 本で通し、code=NULL の従業員でもトークンが払い出されることを保証する。
  test("issues tokens for a freshly provisioned employee whose code is NULL", async () => {
    // 従業員 seed を張らない空 DB。プロビジョニングが code=NULL の従業員を新規作成する。
    const db = createD1TestDatabase(loadSchema())

    const provisionResponse = await postProvisioning(db, {
      subject: "ext-null-code",
      email: "you+extnull@example.com",
      name: "Externally Provisioned",
    })
    expect(provisionResponse.status).toBe(200)

    // 作られた従業員の code は NULL であることを確認する（前提が崩れたら気づけるように）。
    const employee = await db
      .prepare("SELECT id, code FROM employees WHERE name = 'Externally Provisioned'")
      .first<{ id: number; code: string | null }>()
    expect(employee?.code).toBeNull()

    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "ext-null-code",
      email: "you+extnull@example.com",
      jti: "login-jti-null-code",
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(200)
    const body = tokenResponseSchema.parse(await response.json())
    expect(body.access_token.length > 0).toBe(true)
    expect(body.refresh_token.length > 0).toBe(true)
  })

  test("rejects a token with an invalid signature", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      keyId: wrongIdentityKey.keyId,
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(401)
    expect(await auditRows(db)).toEqual([
      { action: "auth.session.identity_login_denied", reason_code: "invalid_token" },
    ])
  })

  test("rejects a token whose issuer does not match", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      issuer: "https://attacker.example/",
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(401)
    expect((await auditRows(db))[0]?.reason_code).toBe("invalid_token")
  })

  test("rejects a token whose audience does not match", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      audience: "some-other-app",
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(401)
    expect((await auditRows(db))[0]?.reason_code).toBe("invalid_token")
  })

  test("rejects an expired token", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch - 120, {
      sub: "external-subject-1",
      iat: nowEpoch - 120,
      exp: nowEpoch - 60,
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(401)
    expect((await auditRows(db))[0]?.reason_code).toBe("invalid_token")
  })

  test("rejects a token whose email is not verified", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      emailVerified: false,
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(401)
    expect((await auditRows(db))[0]?.reason_code).toBe("email_unverified")
  })

  test("returns account_not_found when no identity matches the subject", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "unknown-subject",
      jti: "login-jti-unknown",
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "account not found", code: "account_not_found" })
  })

  test("rejects a suspended account", async () => {
    const db = await createTestDb()
    await db
      .prepare(
        `UPDATE accounts
         SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = 1`,
      )
      .run()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      jti: "login-jti-suspended",
    })

    const response = await postIdentityLogin(db, token)

    expect(response.status).toBe(401)
    expect((await auditRows(db))[0]?.reason_code).toBe("account_inactive")
  })

  test("rejects a replayed token (same jti used twice)", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
      jti: "login-jti-replay",
    })

    const first = await postIdentityLogin(db, token)
    expect(first.status).toBe(200)

    const second = await postIdentityLogin(db, token)
    expect(second.status).toBe(401)

    expect(await systemAuditRows(db)).toEqual([
      { action: "auth.session.identity_login_succeeded", reason_code: null },
    ])
    expect(await auditRows(db)).toEqual([
      { action: "auth.session.identity_login_denied", reason_code: "token_replayed" },
    ])
  })

  test("rejects when identity login is not configured", async () => {
    const db = await createTestDb()
    const token = await createIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "external-subject-1",
    })

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/auth/identity/login",
      token: null,
      method: "POST",
      body: { token },
      now,
      // IDENTITY_JWKS / IDENTITY_ISSUER を渡さない = 未設定。
    })

    expect(response.status).toBe(401)
    expect(await auditRows(db)).toEqual([])
  })
})
