import { describe, expect, test } from "bun:test"
import { seedBudgets } from "@/contexts/expense/infrastructure/seed/seed-budgets"
import { seedDepartments } from "@/contexts/company/infrastructure/seed/seed-departments"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { createTestToken } from "@/api/test/support/create-test-token"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "budget-route-test-secret"

const now = "2026-07-08T00:00:00.000Z"

const budgetResponseSchema = z.object({
  id: z.number(),
  department_id: z.number(),
  fiscal_period: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  amount: z.number(),
  name: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
})

const listItemSchema = z.object({
  id: z.number(),
  department_id: z.number(),
  department_name: z.string().nullable(),
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
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "departments",
    seedDepartments.map((department) => ({ id: department.id, name: department.name })),
  )

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

  await seedD1(
    db,
    "department_budgets",
    seedBudgets.map((budget) => ({
      id: budget.id,
      department_id: budget.departmentId,
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
    now,
  })
}

describe("GET /department-budgets", () => {
  test("returns budgets with department name for a budget:manage role", async () => {
    const response = await request({
      path: "/department-budgets",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(2)
      expect(parsed.data.data[0]?.department_name).toBe("開発部")
    }
  })

  test("filters by fiscal_period and department_id", async () => {
    const response = await request({
      path: "/department-budgets?department_id=3&fiscal_period=2026",
      token: await tokenFor(1, "root"),
    })

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(1)
      expect(parsed.data.data[0]?.department_id).toBe(3)
    }
  })

  test("returns 403 without budget:manage", async () => {
    const response = await request({
      path: "/department-budgets",
      token: await tokenFor(2, "manager"),
    })

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/department-budgets", token: null })

    expect(response.status).toBe(401)
  })
})

describe("POST /department-budgets", () => {
  test("returns 201 with the created budget", async () => {
    const response = await request({
      path: "/department-budgets",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: {
        department_id: 5,
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
      expect(parsed.data.department_id).toBe(5)
      expect(parsed.data.amount).toBe(300000)
      expect(parsed.data.note).toBeNull()
      expect(parsed.data.created_at).toBe(now)
    }
  })

  test("returns 404 when the department does not exist", async () => {
    const response = await request({
      path: "/department-budgets",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: {
        department_id: 999,
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
      path: "/department-budgets",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: {
        department_id: 3,
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
      path: "/department-budgets",
      token: await tokenFor(1, "root"),
      method: "POST",
      body: {
        department_id: 3,
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
      path: "/department-budgets",
      token: await tokenFor(2, "manager"),
      method: "POST",
      body: {
        department_id: 3,
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
