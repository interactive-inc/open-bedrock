import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedExpenseApprovals } from "@/contexts/expense/infrastructure/seed/seed-expense-approvals"
import { seedExpenses } from "@/contexts/expense/infrastructure/seed/seed-expenses"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { verifyStandardCompanyMigration } from "@/api/test/support/verify-standard-company-migration"
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
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

  await seedIamForEmployees(db)

  await seedD1(db, "org_memberships", [
    { department_code: "D003", employee_code: "E005", manager_employee_code: "E002" },
  ])

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
    // seed の expense_approvals は空である前提（カウントは 1 回目の承認分のみになる）。
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
