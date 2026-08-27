import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { z } from "zod"

const jwtSecret = "provisioning-route-jwt-secret"
const provisioningApiKey = "provisioning-route-api-key"

const summarySchema = z.strictObject({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
})

function createTestDb(): D1Database {
  // roles/permissions マスタは migration(0004) で投入済み。従業員 seed は不要（新規作成を検証する）。
  return createD1TestDatabase(loadSchema())
}

async function postProvisioning(
  db: D1Database,
  body: unknown,
  options: { apiKey?: string | null } = {},
): Promise<Response> {
  const headers: Record<string, string> = {}
  const apiKey = options.apiKey === undefined ? provisioningApiKey : options.apiKey
  if (apiKey !== null) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return requestWithContext({
    db,
    jwtSecret,
    path: "/provisioning/identities",
    token: null,
    method: "POST",
    body,
    headers,
    provisioningApiKey,
  })
}

async function count(db: D1Database, table: string, where = ""): Promise<number> {
  const clause = where === "" ? "" : ` WHERE ${where}`
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}${clause}`).first<number>("n")
  return row ?? 0
}

describe("POST /provisioning/identities", () => {
  test("creates an employee with a null code, account, oidc identity, and member role", async () => {
    const db = createTestDb()

    const response = await postProvisioning(db, {
      subject: "ext-100",
      email: "you+ext100@example.com",
      name: "External Hundred",
    })

    expect(response.status).toBe(200)
    expect(summarySchema.parse(await response.json())).toEqual({
      created: 1,
      updated: 0,
      skipped: 0,
    })

    const employee = await db
      .prepare(
        `SELECT employee_code AS code, official_name AS name
         FROM company_employees WHERE official_name = 'External Hundred'`,
      )
      .first<{ code: string | null; name: string }>()
    expect(employee?.code).toBeNull()

    const identity = await db
      .prepare(
        `SELECT identity.provider, identity.subject, profile.email, profile.email_verified,
                credential.password_hash
         FROM system_identity_bindings AS identity
         INNER JOIN system_identity_profiles AS profile ON profile.identity_id = identity.id
         LEFT JOIN system_password_credentials AS credential ON credential.identity_id = identity.id
         WHERE identity.subject = 'ext-100'`,
      )
      .first<{
        provider: string
        subject: string
        email: string
        email_verified: number
        password_hash: string | null
      }>()
    expect(identity).toEqual({
      provider: "oidc",
      subject: "ext-100",
      email: "you+ext100@example.com",
      email_verified: 1,
      password_hash: null,
    })

    // member ロールが 1 件付与されている。
    const roleCount = await db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM system_role_bindings binding
         JOIN system_identity_bindings identity ON identity.account_id = binding.account_id
         JOIN system_iam_roles role ON role.id = binding.role_id
         WHERE identity.subject = 'ext-100'
           AND role.key = 'company:member'
           AND binding.revoked_at IS NULL`,
      )
      .first<number>("n")
    expect(roleCount).toBe(1)
  })

  test("is idempotent: syncing the same identity twice does not duplicate rows", async () => {
    const db = createTestDb()
    const payload = { subject: "ext-200", email: "you+ext200@example.com", name: "External Two" }

    const first = await postProvisioning(db, payload)
    expect(summarySchema.parse(await first.json())).toEqual({ created: 1, updated: 0, skipped: 0 })

    const second = await postProvisioning(db, payload)
    // 同一値の再送は skip（no-op）。
    expect(summarySchema.parse(await second.json())).toEqual({ created: 0, updated: 0, skipped: 1 })

    expect(await count(db, "system_identity_bindings", "subject = 'ext-200'")).toBe(1)
    expect(await count(db, "company_employees", "official_name = 'External Two'")).toBe(1)
    expect(
      await count(
        db,
        "system_accounts",
        "id IN (SELECT account_id FROM system_identity_bindings WHERE subject = 'ext-200')",
      ),
    ).toBe(1)
  })

  test("updates email/name for an existing external identity", async () => {
    const db = createTestDb()
    await postProvisioning(db, { subject: "ext-300", email: "old@example.com", name: "Old Name" })

    const response = await postProvisioning(db, {
      subject: "ext-300",
      email: "new@example.com",
      name: "New Name",
    })

    expect(summarySchema.parse(await response.json())).toEqual({
      created: 0,
      updated: 1,
      skipped: 0,
    })

    const identity = await db
      .prepare(
        `SELECT profile.email
         FROM system_identity_bindings AS identity
         INNER JOIN system_identity_profiles AS profile ON profile.identity_id = identity.id
         WHERE identity.subject = 'ext-300'`,
      )
      .first<{ email: string }>()
    expect(identity?.email).toBe("new@example.com")

    const employee = await db
      .prepare(
        `SELECT employee.official_name AS name FROM company_employees AS employee
         JOIN company_account_employee_links AS link ON link.employee_id = employee.id
         JOIN system_identity_bindings i ON i.account_id = link.account_id
         WHERE i.subject = 'ext-300'`,
      )
      .first<{ name: string }>()
    expect(employee?.name).toBe("New Name")
  })

  test("accepts a batch array and reports per-outcome counts", async () => {
    const db = createTestDb()
    await postProvisioning(db, { subject: "ext-400", email: "e400@example.com", name: "Four" })

    const response = await postProvisioning(db, [
      { subject: "ext-400", email: "e400@example.com", name: "Four" }, // skip (unchanged)
      { subject: "ext-401", email: "e401@example.com", name: "FourOne" }, // create
    ])

    expect(summarySchema.parse(await response.json())).toEqual({
      created: 1,
      updated: 0,
      skipped: 1,
    })
    expect(await count(db, "system_identity_bindings", "subject IN ('ext-400', 'ext-401')")).toBe(2)
  })

  test("returns 401 when the API key does not match", async () => {
    const db = createTestDb()

    const response = await postProvisioning(
      db,
      { subject: "ext-500", email: "e500@example.com", name: "Five" },
      { apiKey: "the-wrong-key" },
    )

    expect(response.status).toBe(401)
    expect(await count(db, "system_identity_bindings", "subject = 'ext-500'")).toBe(0)
  })

  test("returns 401 when the Authorization header is missing", async () => {
    const db = createTestDb()

    const response = await postProvisioning(
      db,
      { subject: "ext-501", email: "e501@example.com", name: "FiveOne" },
      { apiKey: null },
    )

    expect(response.status).toBe(401)
  })

  test("rejects an invalid body with 400", async () => {
    const db = createTestDb()

    const response = await postProvisioning(db, { subject: "ext-600", email: "e600@example.com" })

    expect(response.status).toBe(400)
  })

  test.each(["line\nbreak", "ユーザー", "a".repeat(256)])(
    "rejects an invalid subject before persistence",
    async (subject) => {
      const db = createTestDb()

      const response = await postProvisioning(db, {
        subject,
        email: "invalid-subject@example.com",
        name: "Invalid Subject",
      })

      expect(response.status).toBe(400)
      expect(await count(db, "system_identity_bindings")).toBe(0)
      expect(await count(db, "system_accounts")).toBe(0)
    },
  )

  test("rejects with 401 when PROVISIONING_API_KEY is not configured", async () => {
    const db = createTestDb()

    // provisioningApiKey を渡さない = env 未設定。正しそうなキーを送っても拒否される。
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/provisioning/identities",
      token: null,
      method: "POST",
      body: { subject: "ext-700", email: "e700@example.com", name: "Seven" },
      headers: { Authorization: "Bearer any-key" },
    })

    expect(response.status).toBe(401)
    expect(await count(db, "system_identity_bindings", "subject = 'ext-700'")).toBe(0)
  })
})
