import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedExpenses } from "@/contexts/expense/infrastructure/seed/seed-expenses"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"
import { z } from "zod"

const jwtSecret = "expense-admin-route-test-secret"

const expenseAdminResponseSchema = z.object({
  id: z.number(),
  applicant_id: z.number(),
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

  await seedD1(
    db,
    "expenses",
    seedExpenses.map((expense) => ({
      id: expense.id,
      employee_id: expense.employeeId,
      category: expense.category,
      amount: expense.amount,
      spent_at: expense.spentAt,
      note: expense.note,
      status: expense.status,
      created_at: expense.createdAt,
    })),
  )

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

  await verifyStandardCompanyMigration(db)

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
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
    const response = await request("/expenses/admin", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedExpenses.length)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.applicant_name).toBe("Emery Lane")
      expect(first?.applicant_id).toBe(5)
    }
  })

  test("returns 403 for manager", async () => {
    const response = await request("/expenses/admin", await tokenFor(4, "manager"))

    expect(response.status).toBe(403)
  })

  test("returns 403 for member", async () => {
    const response = await request("/expenses/admin", await tokenFor(5, "member"))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/expenses/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by status", async () => {
    const response = await request("/expenses/admin?status=approved", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.status === "approved")).toBe(true)
    }
  })

  test("filters by category", async () => {
    const response = await request("/expenses/admin?category=transport", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.category === "transport")).toBe(true)
    }
  })

  test("filters by applicant_id", async () => {
    const response = await request("/expenses/admin?applicant_id=5", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.applicant_id === 5)).toBe(true)
    }
  })

  test("sorts by amount desc", async () => {
    const response = await request("/expenses/admin?sort=amount_desc", await tokenFor(1, "root"))

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
    const response = await request("/expenses/admin?limit=1", await tokenFor(1, "root"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.total).toBe(seedExpenses.length)
    }
  })
})
