import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedRentalReservations } from "@/infrastructure/seed/seed-rental-reservations"
import { createD1TestDatabase } from "@/interface/test-helpers/d1-test-database"
import { createTestToken } from "@/interface/test-helpers/create-test-token"
import { loadSchema } from "@/interface/test-helpers/load-schema"
import { requestWithContext } from "@/interface/test-helpers/request-with-context"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
import { seedIamForEmployees } from "@/interface/test-helpers/seed-iam-for-employees"

const jwtSecret = "rental-return-route-test-secret"

const seedId = "10000000-0000-0000-0000-000000000001"

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
    "rental_reservations",
    seedRentalReservations.map((reservation) => ({
      id: reservation.id,
      requester_id: reservation.requesterId,
      item_name: reservation.itemName,
      start_date: reservation.startDate,
      end_date: reservation.endDate,
      purpose: reservation.purpose,
      status: reservation.status,
      created_at: reservation.createdAt,
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

async function lend(db: D1Database): Promise<Response> {
  return requestWithContext({
    db,
    jwtSecret,
    path: `/rentals/${seedId}/lend`,
    token: await tokenFor(99),
    method: "POST",
  })
}

describe("POST /rentals/:id/return", () => {
  test("returns 200 and marks the reservation returned for hr", async () => {
    const db = await createTestDb()

    await lend(db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/rentals/${seedId}/return`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(response.status).toBe(200)

    const parsed = z.object({ status: z.string() }).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.status).toBe("returned")
    }
  })

  test("returns 403 for a member", async () => {
    const db = await createTestDb()

    await lend(db)

    const response = await requestWithContext({
      db,
      jwtSecret,
      path: `/rentals/${seedId}/return`,
      token: await tokenFor(5),
      method: "POST",
    })

    expect(response.status).toBe(403)
  })

  test("returns 409 when returning a reservation that is not lent", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/rentals/${seedId}/return`,
      token: await tokenFor(99),
      method: "POST",
    })

    expect(response.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await requestWithContext({
      db: await createTestDb(),
      jwtSecret,
      path: `/rentals/${seedId}/return`,
      token: null,
      method: "POST",
    })

    expect(response.status).toBe(401)
  })
})
