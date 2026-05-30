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

const statusEnum = z.enum(["pending", "approved", "rejected", "settled"])

const expenseDecisionResponseSchema = z.object({
  status: statusEnum,
})

const jwtSecret = "expense-reject-route-test-secret"

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

describe("POST /expenses/:id/reject", () => {
  test("returns 200 and flips status to rejected", async () => {
    const response = await request({
      path: "/expenses/1/reject",
      token: await tokenFor(2, "manager"),
      method: "POST",
      body: { comment: "missing receipt" },
    })

    expect(response.status).toBe(200)

    const parsed = expenseDecisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("rejected")
    }
  })

  test("returns 400 when comment is empty", async () => {
    const response = await request({
      path: "/expenses/1/reject",
      token: await tokenFor(2, "manager"),
      method: "POST",
      body: { comment: "" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/expenses/1/reject",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { comment: "rejected" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request({
      path: "/expenses/9999/reject",
      token: await tokenFor(2, "manager"),
      method: "POST",
      body: { comment: "rejected" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/expenses/1/reject",
      token: null,
      method: "POST",
      body: { comment: "rejected" },
    })

    expect(response.status).toBe(401)
  })
})
