import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { z } from "zod"

const jwtSecret = "thanks-redemption-admin-route-test-secret"

const redemptionAdminResponseSchema = z.object({
  id: z.number(),
  employee_id: zEmployeeId,
  employee_name: z.string(),
  employee_dept_name: z.string().nullable(),
  reward_id: z.number(),
  reward_name: z.string(),
  point_cost: z.number(),
  status: z.enum(["pending", "rejected", "fulfilled"]),
  created_at: z.string(),
  decided_at: z.string().nullable(),
  decider_id: zEmployeeId.nullable(),
})

const listSchema = z.object({
  data: z.array(redemptionAdminResponseSchema),
  total: z.number(),
})

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

  await seedD1(db, "thanks_rewards", [
    {
      id: 1,
      name: "コーヒーチケット",
      point_cost: 50,
      is_active: 1,
      stock: null,
      created_at: "2026-05-01T00:00:00Z",
    },
    {
      id: 2,
      name: "書籍購入補助",
      point_cost: 200,
      is_active: 1,
      stock: 10,
      created_at: "2026-05-01T00:00:00Z",
    },
  ])

  await seedD1(db, "thanks_redemptions", [
    {
      id: 1,
      employee_id: "5",
      reward_id: 1,
      point_cost: 50,
      status: "pending",
      created_at: "2026-06-01T00:00:00Z",
      decided_at: null,
      decider_id: null,
    },
    {
      id: 2,
      employee_id: "10",
      reward_id: 2,
      point_cost: 200,
      status: "fulfilled",
      created_at: "2026-06-05T00:00:00Z",
      decided_at: "2026-06-06T00:00:00Z",
      decider_id: "1",
    },
    {
      id: 3,
      employee_id: "13",
      reward_id: 1,
      point_cost: 50,
      status: "rejected",
      created_at: "2026-06-10T00:00:00Z",
      decided_at: "2026-06-11T00:00:00Z",
      decider_id: "1",
    },
  ])

  await initializeStandardCompanyTestState(db)

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

describe("GET /thanks-redemptions/admin", () => {
  test("returns 200 with all redemptions for admin", async () => {
    const response = await request("/thanks/thanks-redemptions/admin", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(3)

      const first = parsed.data.data.find((item) => item.id === 1)

      expect(first?.employee_name).toBe("Emery Lane")
      expect(first?.reward_name).toBe("コーヒーチケット")
    }
  })

  test("returns 403 for manager", async () => {
    const response = await request("/thanks/thanks-redemptions/admin", await tokenFor(4))

    expect(response.status).toBe(403)
  })

  test("returns 403 for member", async () => {
    const response = await request("/thanks/thanks-redemptions/admin", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/thanks/thanks-redemptions/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by status", async () => {
    const response = await request(
      "/thanks/thanks-redemptions/admin?status=fulfilled",
      await tokenFor(1),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.status === "fulfilled")).toBe(true)
    }
  })

  test("filters by employee_id", async () => {
    const response = await request(
      "/thanks/thanks-redemptions/admin?employee_id=5",
      await tokenFor(1),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.employee_id === toWorkforceEmployeeId(5))).toBe(
        true,
      )
    }
  })

  test("filters by reward_id", async () => {
    const response = await request(
      "/thanks/thanks-redemptions/admin?reward_id=1",
      await tokenFor(1),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.reward_id === 1)).toBe(true)
    }
  })
})
