import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
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
    "employees",
    employees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      dept_id: null,
      dept_name: null,
      position: null,
      status: "active",
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
  await initializeStandardCompanyTestState(database)

  return database
}

describe("GET /directory/accounts", () => {
  test("iam:read を持つ管理者へ Account と従業員プロフィールを返す", async () => {
    const database = await createTestDatabase()
    const token = await createTestToken(jwtSecret, { employeeId: 1 })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/directory/accounts?status=active",
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
    const token = await createTestToken(jwtSecret, { employeeId: 1 })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/directory/accounts?status=active",
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
    const token = await createTestToken(jwtSecret, { employeeId: 2 })
    const response = await requestWithContext({
      db: database,
      jwtSecret,
      path: "/directory/accounts",
      token,
    })

    expect(response.status).toBe(403)
  })
})
