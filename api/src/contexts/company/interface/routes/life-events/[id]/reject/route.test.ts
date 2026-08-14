import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { seedEmployees } from "@/contexts/company/infrastructure/seed/seed-employees"
import { seedLifeEvents } from "@/contexts/company/infrastructure/seed/seed-life-events"
import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/contexts/company/interface/test-helpers/create-test-token"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import { requestWithContext } from "@/contexts/company/interface/test-helpers/request-with-context"
import { seedD1 } from "@/contexts/company/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/contexts/company/interface/test-helpers/seed-iam-for-employees"

const jwtSecret = "life-event-reject-route-test-secret"

const seedId = "20000000-0000-0000-0000-000000000001"

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

  return db
}

function tokenFor(employeeId: number): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: employeeId,
    email: `you+e${String(employeeId).padStart(3, "0")}@example.com`,
  })
}

describe("POST /life-events/:id/reject", () => {
  test("returns 200 and rejects the life event for hr", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/life-events/${seedId}/reject`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = z.object({ status: z.string() }).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("rejected")
    }
  })

  test("returns 403 for a member", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/life-events/${seedId}/reject`,
      token: await tokenFor(5),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when rejecting an already-decided life event", async () => {
    const db = await createTestDb()

    const first = await requestWithContext({
      db,
      jwtSecret,
      path: `/life-events/${seedId}/reject`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(first.status).toBe(200)

    const second = await requestWithContext({
      db,
      jwtSecret,
      path: `/life-events/${seedId}/reject`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(second.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/life-events/${seedId}/reject`,
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })
})
