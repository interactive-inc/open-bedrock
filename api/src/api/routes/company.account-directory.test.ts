import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { describe, expect, test } from "bun:test"

const jwtSecret = "account-directory-route-test-secret"

async function createTestDatabase(): Promise<D1Database> {
  const database = createD1TestDatabase(loadSchema())
  const employees = [
    { id: 1, code: "E001", name: "Admin", email: "admin@example.com", role: "root" },
    { id: 2, code: "E002", name: "Member", email: "member@example.com", role: "member" },
  ]

  await seedD1(
    database,
    "company_employees",
    employees.map((employee) => ({
      id: String(employee.id),
      employee_code: employee.code,
      official_name: employee.name,
      email: employee.email,
      phone: null,
      created_at: 0,
      updated_at: 0,
    })),
  )
  await seedIamForEmployees(
    database,
    employees.map((employee) => ({
      id: employee.id,
      email: employee.email,
      passwordHash: "x",
      role: employee.role,
    })),
  )
  return database
}

describe("GET /directory/accounts", () => {
  test("iam:read を持つ管理者へ Account と従業員プロフィールを返す", async () => {
    const database = await createTestDatabase()
    const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/company/account-directory?status=active",
      token,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: [
        { account_id: "1", name: "Admin", email: "admin@example.com", status: "active" },
        { account_id: "2", name: "Member", email: "member@example.com", status: "active" },
      ],
      total: 2,
    })
  })

  test("失効 Identity を候補から外し、利用可能なメールを決定的に選ぶ", async () => {
    const database = await createTestDatabase()
    await database
      .prepare("UPDATE system_identity_bindings SET revoked_at = 1 WHERE account_id = '2'")
      .run()
    const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(1) })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/company/account-directory?status=active",
      token,
    })
    const body = (await response.json()) as {
      data: ReadonlyArray<{ account_id: string; email: string | null }>
    }

    expect(response.status).toBe(200)
    expect(body.data.find((account) => account.account_id === "2")?.email).toBe(null)
  })

  test("iam:read を持たないメンバーは拒否する", async () => {
    const database = await createTestDatabase()
    const token = await createTestToken(jwtSecret, { employeeId: toWorkforceEmployeeId(2) })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/company/account-directory",
      token,
    })

    expect(response.status).toBe(403)
  })
})
