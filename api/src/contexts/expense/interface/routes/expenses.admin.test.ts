import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedExpenses } from "@/contexts/expense/test/seed/seed-expenses.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { z } from "zod"

const jwtSecret = "expense-admin-route-test-secret"

const expenseAdminResponseSchema = z.object({
  id: z.number(),
  applicant_id: zEmployeeId,
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  category: z.enum(["transport", "supplies", "entertainment", "books", "other"]),
  amount: z.number(),
  spent_at: z.string(),
  status: z.enum(["pending", "approved", "rejected", "settled"]),
  created_at: z.string(),
})

const listSchema = z.object({
  data: z.array(expenseAdminResponseSchema),
  total: z.number(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await initializeStandardCompanyTestState(db)

  await seedD1(
    db,
    "expenses",
    seedExpenses.map((expense) => ({
      id: expense.id,
      employee_id: expense.employeeId,
      organization_unit_id: expense.organizationUnitId,
      category: expense.category,
      amount: expense.amount,
      spent_at: expense.spentAt,
      note: expense.note,
      status: expense.status,
      created_at: expense.createdAt,
    })),
  )

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

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
  })
}

describe("GET /expenses/admin", () => {
  test("returns 200 with all expenses for admin", async () => {
    const response = await request("/expenses/admin", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedExpenses.length)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.applicant_name).toBe("Emery Lane")
      expect(first?.applicant_id).toBe(toWorkforceEmployeeId(5))
    }
  })

  test("returns 403 for manager", async () => {
    const response = await request("/expenses/admin", await tokenFor(4))

    expect(response.status).toBe(403)
  })

  test("returns 403 for member", async () => {
    const response = await request("/expenses/admin", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/expenses/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by status", async () => {
    const response = await request("/expenses/admin?status=approved", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.status === "approved")).toBe(true)
    }
  })

  test("filters by category", async () => {
    const response = await request("/expenses/admin?category=transport", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.category === "transport")).toBe(true)
    }
  })

  test("filters by applicant_id", async () => {
    const response = await request("/expenses/admin?applicant_id=5", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.applicant_id === toWorkforceEmployeeId(5))).toBe(
        true,
      )
    }
  })

  test("sorts by amount desc", async () => {
    const response = await request("/expenses/admin?sort=amount_desc", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      const amounts = parsed.data.data.map((item) => item.amount)

      const sorted = [...amounts].sort((first, second) => second - first)

      expect(amounts).toEqual(sorted)
    }
  })

  test("respects limit", async () => {
    const response = await request("/expenses/admin?limit=1", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.total).toBe(seedExpenses.length)
    }
  })
})
