import { describe, expect, test } from "bun:test"
import { seedBusinessTrips } from "@/contexts/business-trip/infrastructure/seed/seed-business-trips.repository"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees.repository"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const jwtSecret = "business-trip-admin-route-test-secret"

const listSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      traveler_id: z.number(),
      destination: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      purpose: z.string(),
      estimated_cost: z.number().nullable(),
      status: z.string(),
      created_at: z.string(),
    }),
  ),
  total: z.number(),
})

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "business_trips",
    seedBusinessTrips.map((businessTrip) => ({
      id: businessTrip.id,
      traveler_id: businessTrip.travelerId,
      destination: businessTrip.destination,
      start_date: businessTrip.startDate,
      end_date: businessTrip.endDate,
      purpose: businessTrip.purpose,
      estimated_cost: businessTrip.estimatedCost,
      status: businessTrip.status,
      created_at: businessTrip.createdAt,
    })),
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

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
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

describe("GET /business-trips/admin", () => {
  test("returns 200 with all business trips for admin", async () => {
    const response = await request("/business-trips/admin", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedBusinessTrips.length)
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/business-trips/admin", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/business-trips/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by employee_id", async () => {
    const response = await request("/business-trips/admin?employee_id=2", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.every((item) => item.traveler_id === 2)).toBe(true)
      expect(parsed.data.data.length).toBeGreaterThan(0)
    }
  })
})
