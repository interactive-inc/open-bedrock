import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees.repository"
import { seedExpenseApprovals } from "@/contexts/expense/infrastructure/seed/seed-expense-approvals.repository"
import { seedExpenses } from "@/contexts/expense/infrastructure/seed/seed-expenses.repository"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const categoryEnum = z.enum(["transport", "supplies", "entertainment", "books", "other"])

const statusEnum = z.enum(["pending", "approved", "rejected", "settled"])

const expenseResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  category: categoryEnum,
  amount: z.number(),
  spent_at: z.string(),
  note: z.string().nullable(),
  status: statusEnum,
  created_at: z.string(),
})

const jwtSecret = "expense-create-route-test-secret"

const now = "2026-01-01T00:00:00.000Z"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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
    "expense_approvals",
    seedExpenseApprovals.map((approval) => ({
      id: approval.id,
      expense_id: approval.expenseId,
      approver_id: approval.approverId,
      action: approval.action,
      comment: approval.comment,
      created_at: approval.createdAt,
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

describe("POST /expenses", () => {
  test("returns 201 with a pending expense from the token employee", async () => {
    const response = await request({
      path: "/expenses",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { category: "transport", amount: 1500, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(201)

    const parsed = expenseResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("pending")
      expect(parsed.data.employee_id).toBe(5)
      expect(parsed.data.note).toBeNull()
      expect(parsed.data.created_at).toBe(now)
    }
  })

  test("returns 400 when amount is not positive", async () => {
    const response = await request({
      path: "/expenses",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { category: "transport", amount: 0, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when amount is not an integer", async () => {
    const response = await request({
      path: "/expenses",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { category: "transport", amount: 1.005, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when amount exceeds the safe integer range", async () => {
    const response = await request({
      path: "/expenses",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { category: "transport", amount: Number.MAX_SAFE_INTEGER + 2, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when category is invalid", async () => {
    const response = await request({
      path: "/expenses",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { category: "travel", amount: 100, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/expenses",
      token: null,
      method: "POST",
      body: { category: "transport", amount: 100, spent_at: "2026-05-25" },
    })

    expect(response.status).toBe(401)
  })
})
