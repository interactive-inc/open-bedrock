import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"

const jwtSecret = "employee-registration-route-test-secret"
const idempotencyKey = "12345678-1234-4abc-8def-1234567890ab"
const body = {
  code: "E100",
  name: "New Employee",
  email: "new-employee@example.com",
  password: "correct horse battery staple",
  role: "member" as const,
  hire_on: "2026-01-01",
  department_code: null,
  position_code: null,
  manager_employee_code: null,
}

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())
  await initializeStandardCompanyTestState(db)
  return db
}

async function post(
  db: D1Database,
  requestBody: typeof body,
  key: string | null = idempotencyKey,
): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: "/company/employee-registrations",
    token: await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) }),
    method: "POST",
    body: requestBody,
    headers: key === null ? {} : { "Idempotency-Key": key },
  })
}

async function count(db: D1Database, table: string, where: string): Promise<number> {
  return (
    (await db
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`)
      .first<number>("count")) ?? 0
  )
}

describe("POST /company/employee-registrations", () => {
  test("creates the Company employee and System identity once, then replays the same command", async () => {
    const db = await createTestDb()

    const created = await post(db, body)
    const replayed = await post(db, body)

    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ code: "E100", replayed: false })
    expect(replayed.status).toBe(200)
    expect(await replayed.json()).toMatchObject({ code: "E100", replayed: true })
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(1)
    expect(await count(db, "system_identity_profiles", "email = 'new-employee@example.com'")).toBe(
      1,
    )
    expect(await count(db, "company_personnel_actions", `operation_id = '${idempotencyKey}'`)).toBe(
      1,
    )
  })

  test("rejects reuse of the key with a different registration", async () => {
    const db = await createTestDb()
    expect((await post(db, body)).status).toBe(201)

    const response = await post(db, { ...body, email: "other@example.com" })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "idempotency_conflict" })
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(1)
  })

  test("requires a UUID idempotency key before persistence", async () => {
    const db = await createTestDb()

    expect((await post(db, body, null)).status).toBe(400)
    expect((await post(db, body, "not-a-uuid")).status).toBe(400)
    expect(await count(db, "company_employees", "employee_code = 'E100'")).toBe(0)
  })
})
