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

const jwtSecret = "budget-detail-route-test-secret"

const budgetDetailSchema = z.object({
  id: z.number(),
  department_id: z.number(),
  department_name: z.string().nullable(),
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
  department_name: true,
  consumed_amount: true,
  remaining_amount: true,
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
    "budgets",
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

describe("GET /budgets/:id", () => {
  test("aggregates approved expenses of the department within the period", async () => {
    // dept 3(Engineering)は seed-expenses の approved 経費(id:2, 3300)のみが消化に入る。
    const response = await request({
      path: "/budgets/1",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = budgetDetailSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.department_id).toBe(3)
      expect(parsed.data.amount).toBe(1000000)
      expect(parsed.data.consumed_amount).toBe(3300)
      expect(parsed.data.remaining_amount).toBe(996700)
    }
  })

  test("returns zero consumption when no approved expenses match", async () => {
    // dept 4(Sales)の seed-expenses は id:3 のみで status は pending → 消化 0。
    const response = await request({
      path: "/budgets/2",
      token: await tokenFor(1, "root"),
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
      path: "/budgets/999",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(404)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/budgets/1",
      token: await tokenFor(2, "manager"),
    })

    expect(response.status).toBe(403)
  })
})

describe("PATCH /budgets/:id", () => {
  test("updates amount, name and note", async () => {
    const response = await request({
      path: "/budgets/1",
      token: await tokenFor(1, "root"),
      method: "PATCH",
      body: { amount: 1200000, name: "Engineering FY2026 (revised)", note: "raised" },
    })

    expect(response.status).toBe(200)

    const body = budgetSchema.parse(await response.json())

    expect(body.amount).toBe(1200000)
    expect(body.name).toBe("Engineering FY2026 (revised)")
    expect(body.note).toBe("raised")
    expect(body.department_id).toBe(3)
  })

  test("returns 404 for a missing budget", async () => {
    const response = await request({
      path: "/budgets/999",
      token: await tokenFor(1, "root"),
      method: "PATCH",
      body: { amount: 1, name: "x" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/budgets/1",
      token: await tokenFor(2, "manager"),
      method: "PATCH",
      body: { amount: 1, name: "x" },
    })

    expect(response.status).toBe(403)
  })
})

describe("DELETE /budgets/:id", () => {
  test("returns 204 and removes the budget", async () => {
    const response = await request({
      path: "/budgets/1",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 404 for a missing budget", async () => {
    const response = await request({
      path: "/budgets/999",
      token: await tokenFor(1, "root"),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/budgets/1",
      token: await tokenFor(2, "manager"),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })
})
