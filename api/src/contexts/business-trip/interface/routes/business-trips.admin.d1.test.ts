import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { seedBusinessTrips } from "@/contexts/business-trip/test/seed/seed-business-trips.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1Pool, startLocalD1Pool } from "@tests/d1/support/start-local-d1-pool"

let pool: LocalD1Pool

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  pool = await startLocalD1Pool(4)
})

afterAll(async () => {
  await pool.dispose()
})

const jwtSecret = "business-trip-admin-route-test-secret"

const listSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      traveler_id: zEmployeeId,
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
  const db = await pool.next()

  await initializeStandardCompanyTestState(db)

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

describe("GET /business-trips/admin", () => {
  test("returns 200 with all business trips for admin", async () => {
    const response = await request("/business-trip/business-trips/admin", await tokenFor(1))

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.total).toBe(seedBusinessTrips.length)
    }
  })

  test("returns 403 for a member", async () => {
    const response = await request("/business-trip/business-trips/admin", await tokenFor(5))

    expect(response.status).toBe(403)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request("/business-trip/business-trips/admin", null)

    expect(response.status).toBe(401)
  })

  test("filters by employee_id", async () => {
    const response = await request(
      `/business-trip/business-trips/admin?employee_id=${testEmployeeId(2)}`,
      await tokenFor(1),
    )

    expect(response.status).toBe(200)

    const parsed = listSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(
        parsed.data.data.every(
          (item) => item.traveler_id === toWorkforceEmployeeId(testEmployeeId(2)),
        ),
      ).toBe(true)
      expect(parsed.data.data.length).toBeGreaterThan(0)
    }
  })
})
