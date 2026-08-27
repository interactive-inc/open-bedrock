import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedBudgets } from "@/contexts/expense/test/seed/seed-budgets.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedExpenses } from "@/contexts/expense/test/seed/seed-expenses.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "budget-summary-route-test-secret"

const summaryItemSchema = z.object({
  organization_unit_id: z.string(),
  organization_unit_name: z.string().nullable(),
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

  await initializeStandardCompanyTestState(db)

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

  await seedD1(
    db,
    "expense_budgets",
    seedBudgets.map((budget) => ({
      id: budget.id,
      organization_unit_id: budget.organizationUnitId,
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

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
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
      path: "/expense/department-budgets/summary?fiscal_period=2026",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = summarySchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.fiscal_period).toBe("2026")
      expect(parsed.data.data.length).toBe(2)

      const engineering = parsed.data.data.find(
        (row) => row.organization_unit_id === "department:D003",
      )

      expect(engineering?.budget_amount).toBe(1000000)
      expect(engineering?.consumed_amount).toBe(3300)
      expect(engineering?.remaining_amount).toBe(996700)

      const sales = parsed.data.data.find((row) => row.organization_unit_id === "department:D004")

      expect(sales?.consumed_amount).toBe(0)
    }
  })

  test("returns 400 without fiscal_period", async () => {
    const response = await request({
      path: "/expense/department-budgets/summary",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(400)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/expense/department-budgets/summary?fiscal_period=2026",
      token: await tokenFor(2),
    })

    expect(response.status).toBe(403)
  })
})
