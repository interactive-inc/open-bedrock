import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedExpenseApprovals } from "@/infrastructure/seed/seed-expense-approvals"
import { seedExpenses } from "@/infrastructure/seed/seed-expenses"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const categoryEnum = z.enum(["transport", "supplies", "entertainment", "books", "other"])

const statusEnum = z.enum(["pending", "approved", "rejected", "settled"])

const expenseMineResponseSchema = z.object({
  id: z.number(),
  category: categoryEnum,
  amount: z.number(),
  spent_at: z.string(),
  status: statusEnum,
  created_at: z.string(),
})

const jwtSecret = "expense-me-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

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

const expenseMineListResponseSchema = z.object({
  data: z.array(expenseMineResponseSchema),
  total: z.number(),
})

describe("GET /expenses/me", () => {
  test("returns 200 with only the token employee's expenses", async () => {
    const response = await request({ path: "/expenses/me", token: await tokenFor(5, "member") })

    expect(response.status).toBe(200)

    const parsed = expenseMineListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(2)
    }
  })

  test("filters by status", async () => {
    const response = await request({
      path: "/expenses/me?status=approved",
      token: await tokenFor(5, "member"),
    })

    expect(response.status).toBe(200)

    const parsed = expenseMineListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.status).toBe("approved")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/expenses/me", token: null })

    expect(response.status).toBe(401)
  })
})
