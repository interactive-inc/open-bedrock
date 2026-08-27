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

const jwtSecret = "browser-token-route-jwt-secret"
const now = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600
const nowEpochMilliseconds = nowEpoch * 1_000

const tokenResponseSchema = z.strictObject({
  account_id: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
  session_id: z.string(),
  expires_at: z.string(),
})

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

async function seedBrowserLoginCode(
  db: D1Database,
  code: string,
  accountId: number,
  expiresAt: number = nowEpochMilliseconds + 60_000,
): Promise<void> {
  const codeHash = await systemLoginCodeHash(code)
  if (codeHash instanceof Error) throw codeHash
  const createdAt = Math.min(nowEpochMilliseconds, expiresAt - 1)
  await db
    .prepare(
      `INSERT INTO system_browser_login_codes (code_hash, account_id, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(codeHash, String(accountId), createdAt, expiresAt)
    .run()
}

function postBrowserToken(db: D1Database, body: unknown): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/system/browser-sessions",
    token: null,
    method: "POST",
    body,
    now,
  })
}

async function auditRows(
  db: D1Database,
): Promise<Array<{ action: string; reason_code: string | null }>> {
  return (
    await db
      .prepare("SELECT action, reason_code FROM system_audit_events ORDER BY occurred_at, event_id")
      .all<{ action: string; reason_code: string | null }>()
  ).results
}

describe("POST /system/browser-sessions", () => {
  test("exchanges a code issued by /system/browser-login-codes for a session", async () => {
    const db = await createTestDb()
    const bearer = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })

    const issuedResponse = await requestWithContext({
      db,
      jwtSecret,
      path: "/system/browser-login-codes",
      token: bearer,
      method: "POST",
      body: {},
      now,
    })
    expect(issuedResponse.status).toBe(201)
    const issued = codeResponseSchema.parse(await issuedResponse.json())

    const response = await postBrowserToken(db, { code: issued.code })

    expect(response.status).toBe(201)
    const body = tokenResponseSchema.parse(await response.json())
    expect(body.access_token.length > 0).toBe(true)
    expect(body.refresh_token.length > 0).toBe(true)

    // セッション発行の成功監査はここ(token 消費時)で初めて記録される。
    expect(await auditRows(db)).toEqual([{ action: "auth.session.create", reason_code: null }])

    const remaining = await db
      .prepare("SELECT COUNT(*) AS count FROM system_browser_login_codes")
      .first<number>("count")
    expect(remaining).toBe(0)
  })

  test("consumes the code so it cannot be exchanged twice", async () => {
    const db = await createTestDb()
    await seedBrowserLoginCode(db, "raw-code-2", 1)

    const first = await postBrowserToken(db, { code: "raw-code-2" })
    expect(first.status).toBe(201)

    const second = await postBrowserToken(db, { code: "raw-code-2" })
    expect(second.status).toBe(401)

    const remaining = await db
      .prepare("SELECT COUNT(*) AS count FROM system_browser_login_codes")
      .first<number>("count")
    expect(remaining).toBe(0)
  })

  test("returns 401 for an unknown code", async () => {
    const db = await createTestDb()

    const response = await postBrowserToken(db, { code: "never-issued" })

    expect(response.status).toBe(401)
  })

  test("returns 401 for an expired code", async () => {
    const db = await createTestDb()
    await seedBrowserLoginCode(db, "raw-code-expired", 1, nowEpochMilliseconds - 1)

    const response = await postBrowserToken(db, { code: "raw-code-expired" })

    expect(response.status).toBe(401)
  })

  test("returns 401 when the account was suspended after the code was issued", async () => {
    const db = await createTestDb()
    await seedBrowserLoginCode(db, "raw-code-suspended", 1)
    await db
      .prepare(
        `UPDATE system_accounts
         SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = 1`,
      )
      .run()

    const response = await postBrowserToken(db, { code: "raw-code-suspended" })

    expect(response.status).toBe(401)
    expect(await auditRows(db)).toEqual([])
  })

  test("rejects an empty code with a 400", async () => {
    const db = await createTestDb()

    const response = await postBrowserToken(db, { code: "" })

    expect(response.status).toBe(400)
  })
})
