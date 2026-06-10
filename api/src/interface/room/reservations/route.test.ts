import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
import { seedRoomReservations } from "@/infrastructure/seed/seed-room-reservations"
import { seedRooms } from "@/infrastructure/seed/seed-rooms"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const roomReservationResponseSchema = z.object({
  id: z.string(),
  room_id: z.number(),
  reserver_id: z.number(),
  start_at: z.string(),
  end_at: z.string(),
  purpose: z.string().nullable(),
})

const jwtSecret = "room-reservations-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

  await seedD1(
    db,
    "employees",
    seedEmployees.map((employee) => ({
      id: employee.id,
      code: employee.code,
      name: employee.name,
      email: employee.email,
      password_hash: employee.passwordHash,
      role: employee.role,
      dept_id: employee.deptId,
      dept_name: employee.deptName,
      position: employee.position,
      status: employee.status,
    })),
  )

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

  return db
}

function managerToken(): Promise<string> {
  return createTestToken(jwtSecret, {
    employeeId: 4,
    email: "you+e004@example.com",
    role: "manager",
  })
}

async function getRequest(path: string, token: string | null): Promise<Response> {
  return requestWithContext({ db: await createTestDb(), jwtSecret, path, token })
}

async function postReservation(token: string | null, body: unknown): Promise<Response> {
  return requestWithContext({
    db: await createTestDb(),
    jwtSecret,
    path: "/rooms/reservations",
    token,
    method: "POST",
    body,
    now: "2026-05-29T09:00:00Z",
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
      expect(parsed.data.reserver_id).toBe(4)
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
    const response = await getRequest("/rooms/unknown/deep/path", await managerToken())

    expect(response.status).toBe(404)
  })
})
