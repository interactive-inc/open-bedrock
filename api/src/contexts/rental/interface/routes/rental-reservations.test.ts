import { describe, expect, test } from "bun:test"
import { seedRentalReservations } from "@/contexts/rental/test/seed/seed-rental-reservations.test-support"
import { seedEmployees } from "@/api/test/support/company/seed-employees.test-support"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@/api/test/support/initialize-standard-company-test-state"

const rentalReservationResponseSchema = z.object({
  id: z.string(),
  requester_id: z.number(),
  item_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  purpose: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
})

const jwtSecret = "rental-reservations-route-test-secret"

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
  await initializeStandardCompanyTestState(db)

  return db
}

function managerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
  })
}

async function getRequest(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

async function postReservation(token: string | null, body: unknown): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/rental-reservations",
    token,
    method: "POST",
    body,
    now: "2026-06-02T09:00:00Z",
  })
}

describe("POST /rental-reservations", () => {
  test("returns 201 and creates a reservation from a snake_case body", async () => {
    const response = await postReservation(await managerToken(), {
      item_name: "Tripod",
      start_date: "2026-06-25",
      end_date: "2026-06-26",
      purpose: "Photo shoot",
    })

    expect(response.status).toBe(201)

    const parsed = rentalReservationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.requester_id).toBe(4)
      expect(parsed.data.item_name).toBe("Tripod")
      expect(parsed.data.purpose).toBe("Photo shoot")
      expect(parsed.data.status).toBe("requested")
      expect(parsed.data.id.length).toBeGreaterThan(0)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await postReservation(null, {
      item_name: "Tripod",
      start_date: "2026-06-25",
      end_date: "2026-06-26",
      purpose: null,
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when item_name is missing", async () => {
    const response = await postReservation(await managerToken(), {
      start_date: "2026-06-25",
      end_date: "2026-06-26",
    })

    expect(response.status).toBe(400)
  })

  test("returns 404 for an unknown route under /rentals", async () => {
    const response = await getRequest("/rental-reservations/unknown/extra", await managerToken())

    expect(response.status).toBe(404)
  })
})
