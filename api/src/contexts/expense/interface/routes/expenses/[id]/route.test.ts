import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
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

const categoryEnum = z.enum(["transport", "supplies", "entertainment", "books", "other"])

const statusEnum = z.enum(["pending", "approved", "rejected", "settled"])

const expenseDetailResponseSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
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
    { department_code: "D003", employee_code: "E005", manager_employee_code: "E004" },
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

describe("GET /expenses/:id", () => {
  test("returns 200 with the detail for the owner", async () => {
    const response = await request({ path: "/expenses/1", token: await tokenFor(5, "member") })

    expect(response.status).toBe(200)

    const parsed = expenseDetailResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.applicant_name).toBe("Emery Lane")
    }
  })

  test("returns 403 for a non owner member", async () => {
    const response = await request({ path: "/expenses/1", token: await tokenFor(9, "member") })

    expect(response.status).toBe(403)
  })

  test("returns 200 for a manager inside the applicant organization scope", async () => {
    const response = await request({ path: "/expenses/1", token: await tokenFor(4, "manager") })

    expect(response.status).toBe(200)
  })

  test("returns 403 for a manager outside the applicant organization scope", async () => {
    const response = await request({ path: "/expenses/1", token: await tokenFor(2, "manager") })

    expect(response.status).toBe(403)
  })

  test("returns 404 for a non numeric id", async () => {
    const response = await request({ path: "/expenses/abc", token: await tokenFor(5, "member") })

    expect(response.status).toBe(404)
  })

  test("returns 404 for an unknown id", async () => {
    const response = await request({ path: "/expenses/9999", token: await tokenFor(2, "manager") })

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
      token: await tokenFor(5, "member"),
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
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { ...validBody, amount: -100 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 for a zero amount", async () => {
    const response = await request({
      path: "/expenses/1",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { ...validBody, amount: 0 },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 for a non integer amount", async () => {
    const response = await request({
      path: "/expenses/1",
      token: await tokenFor(5, "member"),
      method: "PUT",
      body: { ...validBody, amount: 1.005 },
    })

    expect(response.status).toBe(400)
  })
})
