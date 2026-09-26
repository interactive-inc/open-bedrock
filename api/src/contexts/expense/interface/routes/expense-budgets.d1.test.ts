import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedBudgets } from "@/contexts/expense/test/seed/seed-budgets.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(9)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "budget-route-test-secret"

const now = "2026-07-08T00:00:00.000Z"

const budgetResponseSchema = z.object({
  id: z.uuid(),
  organization_unit_id: z.string(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

const listItemSchema = z.object({
  id: z.uuid(),
  organization_unit_id: z.string(),
  organization_unit_name: z.string().nullable(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

const listSchema = z.object({
  data: z.array(listItemSchema),
  total: z.number(),
})

async function createTestDb(): Promise<D1Database> {
  const db = await pool.next()

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
    "expense_budgets",
    seedBudgets.map((budget) => ({
      id: budget.id,
      organization_unit_id: budget.organizationUnitId,
      fiscal_period: budget.fiscalPeriod,
      period_start: budget.periodStart,
      period_end: budget.periodEnd,
      amount: budget.amount,
      name: budget.name,
      note: budget.note,
      created_at: budget.createdAt,
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
    now,
  })
}

describe("GET /expense-budgets", () => {
  test("returns budgets with department name for a budget:manage role", async () => {
    const response = await request({
      path: "/expense/expense-budgets",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data[0]?.organization_unit_name).toBe("開発部")
    }
  })

  test("filters by fiscal_period and organization_unit_id", async () => {
    const response = await request({
      path: "/expense/expense-budgets?organization_unit_id=0190005e-0000-7000-8000-000044303033&fiscal_period=2026",
      token: await tokenFor(1),
    })

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.organization_unit_id).toBe("0190005e-0000-7000-8000-000044303033")
    }
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/expense/expense-budgets",
      token: await tokenFor(2),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/expense/expense-budgets", token: null })

    expect(response.status).toBe(401)
  })
})

describe("POST /expense-budgets", () => {
  test("returns 201 with the created budget", async () => {
    const response = await request({
      path: "/expense/expense-budgets",
      token: await tokenFor(1),
      method: "POST",
      body: {
        organization_unit_id: "0190005e-0000-7000-8000-000044303035",
        fiscal_period: "2026",
        period_start: "2026-04-01",
        period_end: "2027-03-31",
        amount: 300000,
        name: "CS FY2026",
      },
    })

    expect(response.status).toBe(201)

    const parsed = budgetResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.organization_unit_id).toBe("0190005e-0000-7000-8000-000044303035")
      expect(parsed.data.amount).toBe(300000)
      expect(parsed.data.note).toBeNull()
      expect(parsed.data.created_at).toBe(now)
    }
  })

  test("returns 404 when the department does not exist", async () => {
    const response = await request({
      path: "/expense/expense-budgets",
      token: await tokenFor(1),
      method: "POST",
      body: {
        organization_unit_id: "0190005e-0000-7000-8000-000044393939",
        fiscal_period: "2026",
        period_start: "2026-04-01",
        period_end: "2027-03-31",
        amount: 300000,
        name: "Ghost",
      },
    })

    expect(response.status).toBe(404)
  })

  test("returns 400 when period_end precedes period_start", async () => {
    const response = await request({
      path: "/expense/expense-budgets",
      token: await tokenFor(1),
      method: "POST",
      body: {
        organization_unit_id: "0190005e-0000-7000-8000-000044303033",
        fiscal_period: "2026",
        period_start: "2026-04-01",
        period_end: "2026-03-01",
        amount: 300000,
        name: "Reversed",
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when amount is not positive", async () => {
    const response = await request({
      path: "/expense/expense-budgets",
      token: await tokenFor(1),
      method: "POST",
      body: {
        organization_unit_id: "0190005e-0000-7000-8000-000044303033",
        fiscal_period: "2026",
        period_start: "2026-04-01",
        period_end: "2027-03-31",
        amount: 0,
        name: "Zero",
      },
    })

    expect(response.status).toBe(400)
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/expense/expense-budgets",
      token: await tokenFor(2),
      method: "POST",
      body: {
        organization_unit_id: "0190005e-0000-7000-8000-000044303033",
        fiscal_period: "2026",
        period_start: "2026-04-01",
        period_end: "2027-03-31",
        amount: 300000,
        name: "Nope",
      },
    })

    expect(response.status).toBe(403)
  })
})
