import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedResignations } from "@/contexts/resignation/test/seed/seed-resignations.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "resignation-admin-route-test-secret"

const listSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      employee_id: zEmployeeId,
      resignation_date: z.string(),
      last_working_date: z.string().nullable(),
      reason: z.string().nullable(),
      status: z.string(),
      created_at: z.string(),
    }),
  ),
  total: z.number(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await initializeStandardCompanyTestState(db)

  await seedD1(
    db,
    "resignations",
    seedResignations.map((resignation) => ({
      id: resignation.id,
      employee_id: resignation.employeeId,
      resignation_date: resignation.resignationDate,
      last_working_date: resignation.lastWorkingDate,
      reason: resignation.reason,
      status: resignation.status,
      created_at: resignation.createdAt,
    })),
  )

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

async function request(path: string, token: string | null): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path,
    token,
  })
}

describe("GET /resignations/admin", () => {
  test("returns 200 with all resignations for admin", async () => {
    const response = await request("/resignations/admin", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedResignations.length)
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/resignations/admin", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/resignations/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by employee_id", async () => {
    const response = await request("/resignations/admin?employee_id=2", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.employee_id === toWorkforceEmployeeId(2))).toBe(
        true,
      )
      expect(parsed.data.data.length).toBeGreaterThan(0)
    }
  })
})
