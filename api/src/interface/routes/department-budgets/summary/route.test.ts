import { describe, expect, test } from "bun:test"
import { seedBudgets } from "@/infrastructure/seed/seed-budgets"
import { seedDepartments } from "@/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedExpenses } from "@/infrastructure/seed/seed-expenses"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "budget-summary-route-test-secret"

const summaryItemSchema = z.object({
  department_id: z.number(),
  department_name: z.string().nullable(),
  fiscal_period: z.string(),
  budget_amount: z.number(),
  consumed_amount: z.number(),
  remaining_amount: z.number(),
})

const summarySchema = z.object({
  fiscal_period: z.string(),
  data: z.array(summaryItemSchema),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "departments",
    seedDepartments.map((department) => ({ id: department.id, name: department.name })),
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
    "department_budgets",
    seedBudgets.map((budget) => ({
      id: budget.id,
      department_id: budget.departmentId,
      fiscal_period: budget.fiscalPeriod,
      period_start: budget.periodStart,
      period_end: budget.periodEnd,
      amount: budget.amount,
      name: budget.name,
      note: budget.note,
      created_at: budget.createdAt,
    })),
  )

  return db
}

function tokenFor(employeeId: number, role: string): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
    role: role,
  })
}

async function request(props: { path: string; token: string | null }): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
  })
}

describe("GET /department-budgets/summary", () => {
  test("returns per-department budget, consumption and remaining for the fiscal period", async () => {
    const response = await request({
      path: "/department-budgets/summary?fiscal_period=2026",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = summarySchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.fiscal_period).toBe("2026")
      expect(parsed.data.data.length).toBe(2)

      const engineering = parsed.data.data.find((row) => row.department_id === 3)

      expect(engineering?.budget_amount).toBe(1000000)
      expect(engineering?.consumed_amount).toBe(3300)
      expect(engineering?.remaining_amount).toBe(996700)

      const sales = parsed.data.data.find((row) => row.department_id === 4)

      expect(sales?.consumed_amount).toBe(0)
    }
  })

  test("returns 400 without fiscal_period", async () => {
    const response = await request({
      path: "/department-budgets/summary",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(400)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/department-budgets/summary?fiscal_period=2026",
      token: await tokenFor(2, "manager"),
    })

    expect(response.status).toBe(403)
  })
})
