import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { loginCodeHash } from "@/lib/auth/login-code-hash"
import { z } from "zod"

const jwtSecret = "browser-code-route-jwt-secret"
const now = "2026-01-01T00:00:00.000Z"
const nowEpoch = 1_767_225_600

const codeResponseSchema = z.strictObject({
  code: z.string(),
  expires_in: z.number(),
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

function postBrowserCode(db: D1Database, token: string | null): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/auth/browser/code",
    token,
    method: "POST",
    body: {},
    now,
  })
}

describe("POST /auth/browser/code", () => {
  test("returns 401 without a bearer token", async () => {
    const db = await createTestDb()

    const response = await postBrowserCode(db, null)

    expect(response.status).toBe(401)
  })

  test("issues a one-time code bound to the caller's session, stored only as a hash", async () => {
    const db = await createTestDb()
    const token = await createTestToken(jwtSecret, { employeeId: 1 })

    const response = await postBrowserCode(db, token)

    expect(response.status).toBe(200)
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

    expect(row?.account_id).toBe("1")
    expect(row?.expires_at).toBe(nowEpoch * 1_000 + 60_000)
    // 生 code は保存されず、ハッシュのみが主キーとして残る。
    expect(row?.code_hash).toBe(await loginCodeHash(body.code))
    expect(row?.code_hash === body.code).toBe(false)
  })
})
