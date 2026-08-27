import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
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

const categoryEnum = z.enum(["transport", "supplies", "entertainment", "books", "other"])

const statusEnum = z.enum(["pending", "approved", "rejected", "settled"])

const expenseDetailResponseSchema = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  applicant_name: z.string(),
  category: categoryEnum,
  amount: z.number(),
  spent_at: z.string(),
  note: z.string().nullable(),
  status: statusEnum,
  created_at: z.string(),
})

const jwtSecret = "expense-detail-route-test-secret"

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
    { departmentCode: "D003", employeeCode: "E005", managerEmployeeCode: "E004" },
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

describe("GET /expenses/:id", () => {
  test("returns 200 with the detail for the owner", async () => {
    const response = await request({ path: "/expenses/1", token: await tokenFor(5) })

    expect(response.status).toBe(200)

    const parsed = expenseDetailResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.applicant_name).toBe("Emery Lane")
    }
  })

  test("returns 403 for a non owner member", async () => {
    const response = await request({ path: "/expenses/1", token: await tokenFor(9) })

    expect(response.status).toBe(403)
  })

  test("returns 200 for a manager inside the applicant organization scope", async () => {
    const response = await request({ path: "/expenses/1", token: await tokenFor(4) })

    expect(response.status).toBe(200)
  })

  test("returns 403 for a manager outside the applicant organization scope", async () => {
    const response = await request({ path: "/expenses/1", token: await tokenFor(2) })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a non numeric id", async () => {
    const response = await request({ path: "/expenses/abc", token: await tokenFor(5) })

    expect(response.status).toBe(404)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request({ path: "/expenses/9999", token: await tokenFor(2) })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/expenses/1", token: null })

    expect(response.status).toBe(401)
  })
})

describe("PUT /expenses/:id", () => {
  const validBody = {
    category: "transport",
    amount: 1500,
    spent_at: "2026-05-10",
    note: "updated",
  }

  test("updates the amount for the owner", async () => {
    const response = await request({
      path: "/expenses/1",
      token: await tokenFor(5),
      method: "PUT",
      body: validBody,
    })

    expect(response.status).toBe(200)

    const parsed = expenseDetailResponseSchema
      .omit({ applicant_name: true })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.amount).toBe(1500)
    }
  })

  test("returns 400 for a negative amount", async () => {
    const response = await request({
      path: "/expenses/1",
      token: await tokenFor(5),
      method: "PUT",
      body: { ...validBody, amount: -100 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 for a zero amount", async () => {
    const response = await request({
      path: "/expenses/1",
      token: await tokenFor(5),
      method: "PUT",
      body: { ...validBody, amount: 0 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 for a non integer amount", async () => {
    const response = await request({
      path: "/expenses/1",
      token: await tokenFor(5),
      method: "PUT",
      body: { ...validBody, amount: 1.005 },
    })

    expect(response.status).toBe(400)
  })
})
