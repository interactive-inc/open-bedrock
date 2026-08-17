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

const categoryEnum = z.enum(["transport", "supplies", "entertainment", "books", "other"])

const statusEnum = z.enum(["pending", "approved", "rejected", "settled"])

const expenseInboxResponseSchema = z.object({
  id: z.number(),
  applicant_name: z.string(),
  category: categoryEnum,
  amount: z.number(),
  spent_at: z.string(),
  status: statusEnum,
  created_at: z.string(),
})

const jwtSecret = "expense-inbox-route-test-secret"

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
    { department_code: "D004", employee_code: "E010", manager_employee_code: "E002" },
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

const expenseInboxListResponseSchema = z.object({
  data: z.array(expenseInboxResponseSchema),
  total: z.number(),
})

describe("GET /expenses/inbox", () => {
  test("returns 200 with joined applicant names for a manager", async () => {
    const response = await request({ path: "/expenses/inbox", token: await tokenFor(2, "manager") })

    expect(response.status).toBe(200)

    const parsed = expenseInboxListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
      expect(parsed.data.total).toBe(2)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.applicant_name).toBe("Emery Lane")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request({ path: "/expenses/inbox", token: await tokenFor(5, "member") })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/expenses/inbox", token: null })

    expect(response.status).toBe(401)
  })
})
