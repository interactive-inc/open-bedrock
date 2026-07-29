import { describe, expect, test } from "bun:test"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
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
  { id: 2, code: "M002", email: "you+m002@example.com", role: "manager" },
  { id: 20, code: "R020", email: "you+r020@example.com", role: "member" },
  { id: 23, code: "X023", email: "you+x023@example.com", role: "member" },
]

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    employeeRows.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.code,
      dept_id: 1,
      dept_name: "Dept",
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

  await seedD1(db, "org_memberships", [
    { department_code: "D001", employee_code: "M002", manager_employee_code: null },
    { department_code: "D001", employee_code: "R020", manager_employee_code: "M002" },
    { department_code: "D002", employee_code: "X023", manager_employee_code: null },
  ])

  await seedD1(db, "leave_balances", [
    {
      employee_id: 20,
      fiscal_year: "2026",
      leave_type: "annual",
      granted_days: 20,
      used_days: 2,
      remaining_days: 18,
    },
  ])

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role,
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
    const response = await getRequest(
      "/leave-balances?employee_id=20",
      await tokenFor(2, "manager"),
    )

    expect(response.status).toBe(200)

    const parsed = z.array(balanceSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(1)
      expect(parsed.data[0]?.remaining_days).toBe(18)
    }
  })

  test("member requesting another employee's balance is forbidden", async () => {
    const response = await getRequest(
      "/leave-balances?employee_id=23",
      await tokenFor(20, "member"),
    )

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/leave-balances?employee_id=20", null)

    expect(response.status).toBe(401)
  })
})
