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

const jwtSecret = "expense-approve-route-test-secret"

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

describe("POST /expenses/:id/approve", () => {
  test("returns 200 and flips status to approved", async () => {
    const response = await request({
      path: "/expenses/1/approve",
      token: await tokenFor(2, "manager"),
      method: "POST",
      body: { comment: "looks fine" },
    })

    expect(response.status).toBe(200)

    const parsed = expenseDecisionResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
    }
  })

  test("accepts a null comment", async () => {
    const response = await request({
      path: "/expenses/1/approve",
      token: await tokenFor(2, "manager"),
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(200)
  })

  test("returns 409 for a second decision and keeps a single approval record", async () => {
    const db = await createTestDb()

    const token = await tokenFor(2, "manager")

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: "/expenses/1/approve",
      token,
      method: "POST",
      body: { comment: null },
    })

    expect(first.status).toBe(200)

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: "/expenses/1/reject",
      token,
      method: "POST",
      body: { comment: "too late" },
    })

    expect(second.status).toBe(409)

    const approvals = await db
      .prepare("SELECT COUNT(*) AS approvalCount FROM expense_approvals WHERE expense_id = 1")
      .first("approvalCount")

    expect(approvals).toBe(1)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/expenses/1/approve",
      token: await tokenFor(5, "member"),
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(403)
  })

  test("returns 400 when comment is omitted", async () => {
    const response = await request({
      path: "/expenses/1/approve",
      token: await tokenFor(2, "manager"),
      method: "POST",
      body: {},
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request({
      path: "/expenses/9999/approve",
      token: await tokenFor(2, "manager"),
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/expenses/1/approve",
      token: null,
      method: "POST",
      body: { comment: null },
    })

    expect(response.status).toBe(401)
  })
})
