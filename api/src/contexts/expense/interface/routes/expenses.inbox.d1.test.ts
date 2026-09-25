import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedExpenseApprovals } from "@/contexts/expense/test/seed/seed-expense-approvals.test-support"
import { seedExpenses } from "@/contexts/expense/test/seed/seed-expenses.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import {
  initializeCompanyMembershipTestState,
  initializeStandardCompanyTestState,
} from "@tests/api/support/initialize-standard-company-test-state"
import { z } from "zod"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(3)
})

afterAll(async () => {
  await pool.dispose()
})

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
  const db = await pool.next()

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
    { departmentCode: "D004", employeeCode: "E010", managerEmployeeCode: "E002" },
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

const expenseInboxListResponseSchema = z.object({
  data: z.array(expenseInboxResponseSchema),
  next_offset: z.number().nullable(),
})

describe("GET /expenses/inbox", () => {
  test("旧台帳のpending経費を会社案件の受信箱へ混ぜない", async () => {
    const response = await request({ path: "/expense/expenses/inbox", token: await tokenFor(2) })

    expect(response.status).toBe(200)

    const parsed = expenseInboxListResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data).toEqual([])
      expect(parsed.data.next_offset).toBeNull()
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request({ path: "/expense/expenses/inbox", token: await tokenFor(5) })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/expense/expenses/inbox", token: null })

    expect(response.status).toBe(401)
  })
})
