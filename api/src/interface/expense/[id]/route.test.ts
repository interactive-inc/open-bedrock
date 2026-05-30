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

  test("returns 400 for a non numeric id", async () => {
    const response = await request({ path: "/expenses/abc", token: await tokenFor(5, "member") })

    expect(response.status).toBe(400)
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
