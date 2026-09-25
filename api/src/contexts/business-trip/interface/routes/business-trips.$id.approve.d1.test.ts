import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { seedBusinessTrips } from "@/contexts/business-trip/test/seed/seed-business-trips.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

const jwtSecret = "business-trip-approve-route-test-secret"

const seedId = "10000000-0000-4000-8000-000000000001"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["approve", "member", "conflict", "unauthenticated"] })
})

afterAll(async () => {
  await local.dispose()
})

async function createTestDb(name: string): Promise<D1Database> {
  const db = await local.database(name)

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

  await seedIamForEmployees(db, [
    { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "hr" },
    { id: 5, email: "you+e005@example.com", passwordHash: "hash", role: "member" },
  ])

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
  await initializeStandardCompanyTestState(db)

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: toWorkforceEmployeeId(employeeId),
  })
}

function storedStatus(db: D1Database): Promise<string | null> {
  return db
    .prepare("SELECT status FROM business_trips WHERE id = ?1")
    .bind(seedId)
    .first<string>("status")
}

describe("POST /business-trips/:id/approve on local D1", () => {
  test("returns 200 and approves the trip for the traveler's manager", async () => {
    const db = await createTestDb("approve")

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/business-trip/business-trips/${seedId}/approve`,
      token: await tokenFor(1),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = z.object({ status: z.string() }).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
    }

    expect(await storedStatus(db)).toBe("approved")
  })

  test("returns 403 for a member and leaves the trip requested", async () => {
    const db = await createTestDb("member")

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/business-trip/business-trips/${seedId}/approve`,
      token: await tokenFor(5),
      method: "POST",
    })

    expect(response.status).toBe(403)
    expect(await storedStatus(db)).toBe("requested")
  })

  test("returns 409 when approving an already-approved trip", async () => {
    const db = await createTestDb("conflict")

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: `/business-trip/business-trips/${seedId}/approve`,
      token: await tokenFor(1),
      method: "POST",
    })

    expect(first.status).toBe(200)

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: `/business-trip/business-trips/${seedId}/approve`,
      token: await tokenFor(1),
      method: "POST",
    })

    expect(second.status).toBe(409)
    expect(await storedStatus(db)).toBe("approved")
  })

  test("returns 401 without a bearer token and leaves the trip requested", async () => {
    const db = await createTestDb("unauthenticated")

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/business-trip/business-trips/${seedId}/approve`,
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
    expect(await storedStatus(db)).toBe("requested")
  })
})
