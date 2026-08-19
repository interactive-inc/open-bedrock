import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { systemLoginCodeHash } from "@system/infrastructure/auth/system-login-code-hash"
import { z } from "zod"

const jwtSecret = "cli-token-route-jwt-secret"
const now = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600
const nowEpochMilliseconds = nowEpoch * 1_000

const tokenResponseSchema = z.strictObject({
  access_token: z.string(),
  refresh_token: z.string(),
})

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
  return db
}

async function seedCliLoginCode(
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
      `INSERT INTO system_cli_login_codes (code_hash, account_id, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(codeHash, String(accountId), createdAt, expiresAt)
    .run()
}

function postCliToken(db: D1Database, body: unknown): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/auth/cli/token",
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

describe("POST /auth/cli/token", () => {
  test("exchanges a valid one-time code for a freshly issued session (AccessTokenView shape)", async () => {
    const db = await createTestDb()
    // account.id = employee.id = 1 (seedIamForEmployees の慣習)。
    await seedCliLoginCode(db, "raw-code-1", 1)

    const response = await postCliToken(db, { code: "raw-code-1" })

    expect(response.status).toBe(200)
    const body = tokenResponseSchema.parse(await response.json())
    expect(body.access_token.length > 0).toBe(true)
    expect(body.refresh_token.length > 0).toBe(true)

    // セッション発行の成功監査はここ(token 消費時)で初めて記録される。
    expect(await auditRows(db)).toEqual([{ action: "auth.session.create", reason_code: null }])

    // トークンは system_cli_login_codes に一切保存されていない（既に行ごと消費済み）。
    const remaining = await db
      .prepare("SELECT COUNT(*) AS count FROM system_cli_login_codes")
      .first<number>("count")
    expect(remaining).toBe(0)
  })

  test("consumes the code so it cannot be exchanged twice", async () => {
    const db = await createTestDb()
    await seedCliLoginCode(db, "raw-code-2", 1)

    const first = await postCliToken(db, { code: "raw-code-2" })
    expect(first.status).toBe(200)

    const second = await postCliToken(db, { code: "raw-code-2" })
    expect(second.status).toBe(401)

    const remaining = await db
      .prepare("SELECT COUNT(*) AS count FROM system_cli_login_codes")
      .first<number>("count")
    expect(remaining).toBe(0)
  })

  test("returns 401 for an unknown code", async () => {
    const db = await createTestDb()

    const response = await postCliToken(db, { code: "never-issued" })

    expect(response.status).toBe(401)
  })

  test("returns 401 for an expired code", async () => {
    const db = await createTestDb()
    await seedCliLoginCode(db, "raw-code-expired", 1, nowEpochMilliseconds - 1)

    const response = await postCliToken(db, { code: "raw-code-expired" })

    expect(response.status).toBe(401)
  })

  test("returns 401 when the account was suspended after the code was issued", async () => {
    const db = await createTestDb()
    await seedCliLoginCode(db, "raw-code-suspended", 1)
    await db
      .prepare(
        `UPDATE system_accounts
         SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = 1`,
      )
      .run()

    const response = await postCliToken(db, { code: "raw-code-suspended" })

    expect(response.status).toBe(401)
    // セッションは発行されていない。
    expect(await auditRows(db)).toEqual([])
  })

  test("rejects an empty code with a 400", async () => {
    const db = await createTestDb()

    const response = await postCliToken(db, { code: "" })

    expect(response.status).toBe(400)
  })
})
