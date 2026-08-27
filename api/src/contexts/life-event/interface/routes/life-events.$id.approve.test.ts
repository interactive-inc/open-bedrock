import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedLifeEvents } from "@/contexts/life-event/test/seed/seed-life-events.test-support"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { createTestToken } from "@tests/api/support/create-test-token"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const jwtSecret = "life-event-approve-route-test-secret"

const seedId = "20000000-0000-0000-0000-000000000001"

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

  await seedIamForEmployees(db, [
    { id: 99, email: "you+e099@example.com", passwordHash: "hash", role: "hr" },
    { id: 5, email: "you+e005@example.com", passwordHash: "hash", role: "member" },
  ])

  await seedD1(
    db,
    "life_events",
    seedLifeEvents.map((lifeEvent) => ({
      id: lifeEvent.id,
      employee_id: lifeEvent.employeeId,
      event_type: lifeEvent.eventType,
      event_date: lifeEvent.eventDate,
      detail: lifeEvent.detail,
      status: lifeEvent.status,
      created_at: lifeEvent.createdAt,
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

describe("POST /life-events/:id/approve", () => {
  test("returns 200 and approves the life event for hr", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/life-events/${seedId}/approve`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = z.object({ status: z.string() }).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("approved")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/life-events/${seedId}/approve`,
      token: await tokenFor(5),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when approving an already-approved life event", async () => {
    const db = await createTestDb()

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: `/life-events/${seedId}/approve`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(first.status).toBe(200)

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: `/life-events/${seedId}/approve`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(second.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/life-events/${seedId}/approve`,
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })
})
