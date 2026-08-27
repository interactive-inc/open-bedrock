import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import { z } from "zod"

const jwtSecret = "leave-balance-route-test-secret"

const balanceSchema = z.object({
  fiscal_year: z.string(),
  leave_type: z.string(),
  granted_days: z.number(),
  used_days: z.number(),
  remaining_days: z.number(),
})

/** manager(id2)が id20 を配下に持つ。id23 は無関係。当年度は 2026(NOW 未設定時の today 依存を避けるため fiscal_year を合わせる)。 */
const employeeRows = [
  { id: 2, code: "M002", email: "you+m002@example.com", role: "manager", departmentId: 1 },
  { id: 20, code: "R020", email: "you+r020@example.com", role: "member", departmentId: 1 },
  { id: 23, code: "X023", email: "you+x023@example.com", role: "member", departmentId: 2 },
]

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedCompanyEmployees(
    db,
    employeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      deptId: employee.departmentId,
      deptName: "Dept",
      position: "-",
      status: "active",
    })),
  )

  await seedIamForEmployees(
    db,
    employeeRows.map((employee) => ({
      id: employee.id,
      email: employee.email,
      passwordHash: "x",
      role: employee.role,
    })),
  )

  await seedD1(db, "leave_balances", [
    {
      employee_id: "20",
      fiscal_year: "2026",
      leave_type: "annual",
      granted_days: 20,
      used_days: 2,
      remaining_days: 18,
    },
  ])

  await initializeCompanyTestFixture({
    db,
    employees: employeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      deptId: employee.departmentId,
      status: "active",
    })),
    departments: [
      { id: 1, code: "D001", name: "Dept One", managerEmployeeCode: "M002" },
      { id: 2, code: "D002", name: "Dept Two" },
    ],
    memberships: [
      { departmentCode: "D001", employeeCode: "M002", managerEmployeeCode: null },
      { departmentCode: "D001", employeeCode: "R020", managerEmployeeCode: "M002" },
      { departmentCode: "D002", employeeCode: "X023", managerEmployeeCode: null },
    ],
  })

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function getRequest(path: string, token: string | null): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
    now: "2026-06-01T00:00:00Z",
  })
}

describe("GET /leave-balances", () => {
  test("manager reads a report's balance via employee_id", async () => {
    const response = await getRequest("/leave/leave-balances?employee_id=20", await tokenFor(2))

    expect(response.status).toBe(200)

    const parsed = z.array(balanceSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0]?.remaining_days).toBe(18)
    }
  })

  test("member requesting another employee's balance is forbidden", async () => {
    const response = await getRequest("/leave/leave-balances?employee_id=23", await tokenFor(20))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/leave/leave-balances?employee_id=20", null)

    expect(response.status).toBe(401)
  })
})
