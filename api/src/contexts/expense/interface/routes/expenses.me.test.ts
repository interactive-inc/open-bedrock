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
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

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

const expenseMineListResponseSchema = z.object({
  data: z.array(expenseMineResponseSchema),
  total: z.number(),
})

describe("GET /expenses/me", () => {
  test("returns 200 with only the token employee's expenses", async () => {
    const response = await request({ path: "/expenses/me", token: await tokenFor(5) })

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
      token: await tokenFor(5),
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
