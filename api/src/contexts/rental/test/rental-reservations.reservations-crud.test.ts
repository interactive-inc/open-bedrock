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

const jwtSecret = "rental-reservations-crud-test-secret"

const ownReservationId = "10000000-0000-0000-0000-000000000002"

const othersReservationId = "10000000-0000-0000-0000-000000000001"

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

async function request(props: {
  path: string
  token: string | null
  method?: string
  body?: unknown
}): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: props.path,
    token: props.token,
    method: props.method,
    body: props.body,
  })
}

describe("GET /rental-reservations/me", () => {
  test("returns only the viewer's reservations", async () => {
    const response = await request({ path: "/rental-reservations/me", token: await managerToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(rentalReservationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].requester_id).toBe(toWorkforceEmployeeId(4))
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/rental-reservations/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /rental-reservations/:id", () => {
  test("returns the reservation for its requester", async () => {
    const response = await request({
      path: `/rental-reservations/${ownReservationId}`,
      token: await managerToken(),
    })

    expect(response.status).toBe(200)

    const parsed = rentalReservationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownReservationId)
    }
  })

  test("returns 403 for another person's reservation", async () => {
    const response = await request({
      path: `/rental-reservations/${othersReservationId}`,
      token: await managerToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown reservation", async () => {
    const response = await request({
      path: "/rental-reservations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await managerToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /rental-reservations/:id", () => {
  test("updates the item, period and purpose of the viewer's reservation", async () => {
    const response = await request({
      path: `/rental-reservations/${ownReservationId}`,
      token: await managerToken(),
      method: "PUT",
      body: {
        item_name: "Monitor",
        start_date: "2026-06-16",
        end_date: "2026-06-21",
        purpose: "Remote work",
      },
    })

    expect(response.status).toBe(200)

    const parsed = rentalReservationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.item_name).toBe("Monitor")
      expect(parsed.data.start_date).toBe("2026-06-16")
      expect(parsed.data.purpose).toBe("Remote work")
    }
  })

  test("returns 403 when updating another person's reservation", async () => {
    const response = await request({
      path: `/rental-reservations/${othersReservationId}`,
      token: await managerToken(),
      method: "PUT",
      body: {
        item_name: "Monitor",
        start_date: "2026-06-16",
        end_date: "2026-06-21",
        purpose: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown reservation", async () => {
    const response = await request({
      path: "/rental-reservations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await managerToken(),
      method: "PUT",
      body: {
        item_name: "Monitor",
        start_date: "2026-06-16",
        end_date: "2026-06-21",
        purpose: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /rental-reservations/:id", () => {
  test("cancels the viewer's reservation and returns 204", async () => {
    const response = await request({
      path: `/rental-reservations/${ownReservationId}`,
      token: await managerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 403 when cancelling another person's reservation", async () => {
    const response = await request({
      path: `/rental-reservations/${othersReservationId}`,
      token: await managerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown reservation", async () => {
    const response = await request({
      path: "/rental-reservations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await managerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/rental-reservations/${ownReservationId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
