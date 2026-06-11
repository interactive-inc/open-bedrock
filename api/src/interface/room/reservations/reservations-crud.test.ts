import { describe, expect, test } from "bun:test"
import { seedRoomReservations } from "@/infrastructure/seed/seed-room-reservations"
import { seedRooms } from "@/infrastructure/seed/seed-rooms"
import { seedEmployees } from "@/infrastructure/seed/seed-employees"
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

const jwtSecret = "room-reservations-crud-test-secret"

const ownReservationId = "00000000-0000-0000-0000-000000000002"

const othersReservationId = "00000000-0000-0000-0000-000000000001"

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

describe("GET /rooms/reservations/me", () => {
  test("returns only the viewer's reservations", async () => {
    const response = await request({ path: "/rooms/reservations/me", token: await managerToken() })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomReservationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0].reserver_id).toBe(4)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({ path: "/rooms/reservations/me", token: null })

    expect(response.status).toBe(401)
  })
})

describe("GET /rooms/reservations/:id", () => {
  test("returns the reservation for its reserver", async () => {
    const response = await request({
      path: `/rooms/reservations/${ownReservationId}`,
      token: await managerToken(),
    })

    expect(response.status).toBe(200)

    const parsed = roomReservationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.id).toBe(ownReservationId)
    }
  })

  test("returns 403 for another person's reservation", async () => {
    const response = await request({
      path: `/rooms/reservations/${othersReservationId}`,
      token: await managerToken(),
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown reservation", async () => {
    const response = await request({
      path: "/rooms/reservations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await managerToken(),
    })

    expect(response.status).toBe(404)
  })
})

describe("PUT /rooms/reservations/:id", () => {
  test("updates the time and purpose of the viewer's reservation", async () => {
    const response = await request({
      path: `/rooms/reservations/${ownReservationId}`,
      token: await managerToken(),
      method: "PUT",
      body: {
        start_at: "2026-05-29T07:00:00Z",
        end_at: "2026-05-29T08:00:00Z",
        purpose: "Rescheduled review",
      },
    })

    expect(response.status).toBe(200)

    const parsed = roomReservationResponseSchema.safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.start_at).toBe("2026-05-29T07:00:00Z")
      expect(parsed.data.purpose).toBe("Rescheduled review")
    }
  })

  test("returns 403 when updating another person's reservation", async () => {
    const response = await request({
      path: `/rooms/reservations/${othersReservationId}`,
      token: await managerToken(),
      method: "PUT",
      body: {
        start_at: "2026-05-29T07:00:00Z",
        end_at: "2026-05-29T08:00:00Z",
        purpose: null,
      },
    })

    expect(response.status).toBe(403)
  })

  test("returns 404 for an unknown reservation", async () => {
    const response = await request({
      path: "/rooms/reservations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await managerToken(),
      method: "PUT",
      body: {
        start_at: "2026-05-29T07:00:00Z",
        end_at: "2026-05-29T08:00:00Z",
        purpose: null,
      },
    })

    expect(response.status).toBe(404)
  })
})

describe("DELETE /rooms/reservations/:id", () => {
  test("cancels the viewer's reservation and returns 204", async () => {
    const response = await request({
      path: `/rooms/reservations/${ownReservationId}`,
      token: await managerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(204)
  })

  test("returns 404 when cancelling another person's reservation", async () => {
    const response = await request({
      path: `/rooms/reservations/${othersReservationId}`,
      token: await managerToken(),
      method: "DELETE",
    })

    // Atomic ownership check: deleteByIdAndReserverId returns null for both
    // non-existent and non-owned reservations to avoid leaking existence.
    expect(response.status).toBe(404)
  })

  test("returns 404 for an unknown reservation", async () => {
    const response = await request({
      path: "/rooms/reservations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      token: await managerToken(),
      method: "DELETE",
    })

    expect(response.status).toBe(404)
  })

  test("returns 401 without a bearer token", async () => {
    const response = await request({
      path: `/rooms/reservations/${ownReservationId}`,
      token: null,
      method: "DELETE",
    })

    expect(response.status).toBe(401)
  })
})
