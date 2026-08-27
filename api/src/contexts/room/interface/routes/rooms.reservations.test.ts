import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedRoomReservations } from "@/contexts/room/test/seed/seed-room-reservations.test-support"
import { seedRooms } from "@/contexts/room/test/seed/seed-rooms.test-support"
import { createTestToken } from "@tests/api/support/create-test-token"
import { createD1TestDatabase } from "@tests/api/support/d1-test-database"
import { loadSchema } from "@tests/api/support/load-schema"
import { requestWithContext } from "@tests/api/support/request-with-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { seedCompanyEmployees } from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"
import { z } from "zod"
import { initializeStandardCompanyTestState } from "@tests/api/support/initialize-standard-company-test-state"

const roomReservationResponseSchema = z.object({
  id: z.string(),
  room_id: z.number(),
  reserver_id: zEmployeeId,
  start_at: z.string(),
  end_at: z.string(),
  purpose: z.string().nullable(),
})

const jwtSecret = "room-reservations-route-test-secret"

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
    "rooms",
    seedRooms.map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      location: room.location,
    })),
  )

  await seedD1(
    db,
    "room_reservations",
    seedRoomReservations.map((reservation) => ({
      id: reservation.id,
      room_id: reservation.roomId,
      reserver_id: reservation.reserverId,
      start_at: reservation.startAt,
      end_at: reservation.endAt,
      purpose: reservation.purpose,
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
    path: "/room/rooms/reservations",
    token,
    method: "POST",
    body,
    now: "2026-05-29T00:00:00Z",
  })
}

describe("POST /rooms/reservations", () => {
  test("returns 201 and creates a reservation from a snake_case body", async () => {
    const response = await postReservation(await managerToken(), {
      room_id: 3,
      start_at: "2026-05-30T01:00:00Z",
      end_at: "2026-05-30T02:00:00Z",
      purpose: "Interview",
    })

    expect(response.status).toBe(201)

    const parsed = roomReservationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.room_id).toBe(3)
      expect(parsed.data.reserver_id).toBe(toWorkforceEmployeeId(4))
      expect(parsed.data.purpose).toBe("Interview")
      expect(parsed.data.id.length).toBeGreaterThan(0)
    }
  })

  test("returns 409 when the slot overlaps an existing reservation", async () => {
    const response = await postReservation(await managerToken(), {
      room_id: 1,
      start_at: "2026-05-29T01:30:00Z",
      end_at: "2026-05-29T02:30:00Z",
      purpose: null,
    })

    expect(response.status).toBe(409)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await postReservation(null, {
      room_id: 3,
      start_at: "2026-05-30T01:00:00Z",
      end_at: "2026-05-30T02:00:00Z",
      purpose: null,
    })

    expect(response.status).toBe(401)
  })

  test("returns 400 when room_id is missing", async () => {
    const response = await postReservation(await managerToken(), {
      start_at: "2026-05-30T01:00:00Z",
      end_at: "2026-05-30T02:00:00Z",
    })

    expect(response.status).toBe(400)
  })

  test("returns 400 when start_at equals end_at (zero-length)", async () => {
    const response = await postReservation(await managerToken(), {
      room_id: 3,
      start_at: "2026-05-30T01:00:00Z",
      end_at: "2026-05-30T01:00:00Z",
      purpose: null,
    })
    expect(response.status).toBe(400)
  })

  test("returns 400 when start_at is after end_at (reversed)", async () => {
    const response = await postReservation(await managerToken(), {
      room_id: 3,
      start_at: "2026-05-30T02:00:00Z",
      end_at: "2026-05-30T01:00:00Z",
      purpose: null,
    })
    expect(response.status).toBe(400)
  })

  test("returns 404 for an unknown route under /rooms", async () => {
    const response = await getRequest("/room/rooms/unknown/deep/path", await managerToken())

    expect(response.status).toBe(404)
  })
})
