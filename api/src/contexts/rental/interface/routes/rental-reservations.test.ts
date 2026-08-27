import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedRentalReservations } from "@/contexts/rental/test/seed/seed-rental-reservations.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const rentalReservationResponseSchema = z.object({
  id: z.string(),
  requester_id: zEmployeeId,
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
    employeeId: toWorkforceEmployeeId(4),
  })
}

async function getRequest(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

async function postReservation(token: string | null, body: unknown): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/rental/rental-reservations",
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
      expect(parsed.data.requester_id).toBe(toWorkforceEmployeeId(4))
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
    const response = await getRequest(
      "/rental/rental-reservations/unknown/extra",
      await managerToken(),
    )

    expect(response.status).toBe(404)
  })
})
