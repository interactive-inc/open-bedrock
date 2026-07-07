import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedBudgets, seedBudgetConsumptions } from "@/infrastructure/seed/seed-budgets"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { seedIamForEmployees } from "@/interface/shared/test/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "budget-route-test-secret"

const budgetSchema = z.object({
  id: z.number(),
  fiscal_year: z.number(),
  department_code: z.string().nullable(),
  title: z.string(),
  amount: z.number(),
  consumed: z.number(),
  remaining: z.number(),
  note: z.string().nullable(),
  created_at: z.string(),
})

const listSchema = z.object({ data: z.array(budgetSchema), total: z.number() })

const consumptionSchema = z.object({
  id: z.number(),
  budget_id: z.number(),
  amount: z.number(),
  note: z.string().nullable(),
  recorded_on: z.string(),
  created_at: z.string(),
})

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

  await seedD1(
    db,
    "budgets",
    seedBudgets.map((budget) => ({
      id: budget.id,
      fiscal_year: budget.fiscalYear,
      department_code: budget.departmentCode,
      title: budget.title,
      amount: budget.amount,
      note: budget.note,
      created_at: budget.createdAt,
    })),
  )

  await seedD1(
    db,
    "budget_consumptions",
    seedBudgetConsumptions.map((consumption) => ({
      id: consumption.id,
      budget_id: consumption.budgetId,
      amount: consumption.amount,
      note: consumption.note,
      recorded_on: consumption.recordedOn,
      created_at: consumption.createdAt,
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

async function request(
  path: string,
  token: string | null,
  method?: string,
  body?: unknown,
): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token, method, body })
}

describe("GET /budgets", () => {
  test("returns 200 with consumed and remaining for a read:all viewer (admin)", async () => {
    const response = await request("/budgets", await tokenFor(1, "admin"))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      const budget1 = parsed.data.data.find((budget) => budget.id === 1)

      expect(budget1?.consumed).toBe(300_000)
      expect(budget1?.remaining).toBe(700_000)

      const budget2 = parsed.data.data.find((budget) => budget.id === 2)

      expect(budget2?.consumed).toBe(0)
      expect(budget2?.remaining).toBe(500_000)
    }
  })

  test("returns 403 for a viewer without read:all (member)", async () => {
    const response = await request("/budgets", await tokenFor(5, "member"))

    expect(response.status).toBe(403)
  })
})

describe("POST /budgets", () => {
  test("creates a budget as admin", async () => {
    const response = await request("/budgets", await tokenFor(1, "admin"), "POST", {
      fiscal_year: 2027,
      department_code: "D002",
      title: "研修",
      amount: 200_000,
    })

    expect(response.status).toBe(201)

    const parsed = budgetSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.remaining).toBe(200_000)
      expect(parsed.data.consumed).toBe(0)
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/budgets", await tokenFor(5, "member"), "POST", {
      fiscal_year: 2027,
      title: "Blocked",
      amount: 1,
    })

    expect(response.status).toBe(403)
  })
})

describe("PUT /budgets/:id", () => {
  test("updates a budget and reflects consumed", async () => {
    const response = await request("/budgets/1", await tokenFor(1, "admin"), "PUT", {
      fiscal_year: 2026,
      department_code: "D001",
      title: "採用広報（改）",
      amount: 1_200_000,
    })

    expect(response.status).toBe(200)

    const parsed = budgetSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.amount).toBe(1_200_000)
      expect(parsed.data.consumed).toBe(300_000)
      expect(parsed.data.remaining).toBe(900_000)
    }
  })
})

describe("POST /budgets/:id/consumptions", () => {
  test("records a consumption as admin", async () => {
    const response = await request("/budgets/2/consumptions", await tokenFor(1, "admin"), "POST", {
      amount: 100_000,
      recorded_on: "2026-05-20",
      note: "ライセンス更新",
    })

    expect(response.status).toBe(201)

    const parsed = consumptionSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.budget_id).toBe(2)
      expect(parsed.data.amount).toBe(100_000)
    }
  })

  test("returns 404 for an unknown budget", async () => {
    const response = await request(
      "/budgets/9999/consumptions",
      await tokenFor(1, "admin"),
      "POST",
      { amount: 1, recorded_on: "2026-05-20" },
    )

    expect(response.status).toBe(404)
  })

  test("returns 403 for a member", async () => {
    const response = await request("/budgets/1/consumptions", await tokenFor(5, "member"), "POST", {
      amount: 1,
      recorded_on: "2026-05-20",
    })

    expect(response.status).toBe(403)
  })
})
