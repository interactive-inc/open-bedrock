import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedExpenseApprovals } from "@/contexts/expense/test/seed/seed-expense-approvals.test-support"
import { seedExpenses } from "@/contexts/expense/test/seed/seed-expenses.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"
import { z } from "zod"

const statusEnum = z.enum(["pending", "approved", "rejected", "settled"])

const expenseDecisionResponseSchema = z.object({
  status: statusEnum,
})

const jwtSecret = "expense-reject-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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

  await initializeCompanyMembershipTestState(db, [
    { departmentCode: "D003", employeeCode: "E005", managerEmployeeCode: "E002" },
  ])

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

  await initializeStandardCompanyTestState(db)

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

describe("POST /expenses/:id/reject", () => {
  test("returns 200 and flips status to rejected", async () => {
    const response = await request({
      path: "/expense/expenses/1/reject",
      token: await tokenFor(2),
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
      path: "/expense/expenses/1/reject",
      token: await tokenFor(2),
      method: "POST",
      body: { comment: "" },
    })

    expect(response.status).toBe(400)
  })

  test("returns 403 for a member", async () => {
    const response = await request({
      path: "/expense/expenses/1/reject",
      token: await tokenFor(5),
      method: "POST",
      body: { comment: "rejected" },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request({
      path: "/expense/expenses/9999/reject",
      token: await tokenFor(2),
      method: "POST",
      body: { comment: "rejected" },
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: "/expense/expenses/1/reject",
      token: null,
      method: "POST",
      body: { comment: "rejected" },
    })

    expect(response.status).toBe(401)
  })
})
