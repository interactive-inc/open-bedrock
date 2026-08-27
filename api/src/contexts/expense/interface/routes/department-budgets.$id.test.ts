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

const jwtSecret = "budget-detail-route-test-secret"

const budgetDetailSchema = z.object({
  id: z.number(),
  organization_unit_id: z.string(),
  organization_unit_name: z.string().nullable(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  consumed_amount: z.number(),
  remaining_amount: z.number(),
  created_at: z.string(),
})

const budgetSchema = budgetDetailSchema.omit({
  organization_unit_name: true,
  consumed_amount: true,
  remaining_amount: true,
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

type RequestProps = {
  path: string
  token: string | null
  method?: string
  body?: unknown
}

async function request(props: RequestProps): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /department-budgets/:id", () => {
  test("aggregates approved expenses of the department within the period", async () => {
    // dept 3(Engineering)は seed-expenses の approved 経費(id:2, 3300)のみが消化に入る。
    const response = await request({
      path: "/expense/department-budgets/1",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = budgetDetailSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.organization_unit_id).toBe("department:D003")
      expect(parsed.data.amount).toBe(1000000)
      expect(parsed.data.consumed_amount).toBe(3300)
      expect(parsed.data.remaining_amount).toBe(996700)
    }
  })

  test("returns zero consumption when no approved expenses match", async () => {
    // dept 4(Sales)の seed-expenses は id:3 のみで status は pending → 消化 0。
    const response = await request({
      path: "/expense/department-budgets/2",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = budgetDetailSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.consumed_amount).toBe(0)
      expect(parsed.data.remaining_amount).toBe(500000)
    }
  })

  test("returns 404 for a missing budget", async () => {
    const response = await request({
      path: "/expense/department-budgets/999",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(404)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/expense/department-budgets/1",
      token: await tokenFor(2),
    })

    expect(response.status).toBe(403)
  })
})

describe("PATCH /department-budgets/:id", () => {
  test("updates amount, name and note", async () => {
    const response = await request({
      path: "/expense/department-budgets/1",
      token: await tokenFor(1),
      method: "PATCH",
      body: { amount: 1200000, name: "Engineering FY2026 (revised)", note: "raised" },
    })

    expect(response.status).toBe(200)

    const body = budgetSchema.parse(await response.json())

    expect(body.amount).toBe(1200000)
    expect(body.name).toBe("Engineering FY2026 (revised)")
    expect(body.note).toBe("raised")
    expect(body.organization_unit_id).toBe("department:D003")
  })

  test("returns 404 for a missing budget", async () => {
    const response = await request({
      path: "/expense/department-budgets/999",
      token: await tokenFor(1),
      method: "PATCH",
      body: { amount: 1, name: "x" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/expense/department-budgets/1",
      token: await tokenFor(2),
      method: "PATCH",
      body: { amount: 1, name: "x" },
    })

    expect(response.status).toBe(403)
  })
})

describe("DELETE /department-budgets/:id", () => {
  test("returns 204 and removes the budget", async () => {
    const response = await request({
      path: "/expense/department-budgets/1",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 404 for a missing budget", async () => {
    const response = await request({
      path: "/expense/department-budgets/999",
      token: await tokenFor(1),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/expense/department-budgets/1",
      token: await tokenFor(2),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })
})
