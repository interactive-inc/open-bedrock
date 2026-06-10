import { describe, expect, test } from "bun:test"
import { seedRoomReservations } from "@/infrastructure/seed/seed-room-reservations"
import { seedRooms } from "@/infrastructure/seed/seed-rooms"
import { createTestToken } from "@/interface/shared/test/create-test-token"
import { createD1TestDatabase } from "@/interface/shared/test/d1-test-database"
import { loadSchema } from "@/interface/shared/test/load-schema"
import { requestWithContext } from "@/interface/shared/test/request-with-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { z } from "zod"

const roomAvailabilityResponseSchema = z.object({
  room: z.object({
    id: z.number(),
    name: z.string(),
    capacity: z.number(),
  }),
  available: z.boolean(),
  conflicts: z.array(z.object({ startAt: z.string(), endAt: z.string() })),
})

const jwtSecret = "room-availability-route-test-secret"

async function createTestDb(): Promise<D1Database> {
  const db = createD1TestDatabase(loadSchema())

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

describe("GET /rooms/availability", () => {
  test("returns 200 with the nested room shape the CLI table expects", async () => {
    const response = await getRequest(
      "/rooms/availability?start_at=2026-05-29T01:30:00Z&end_at=2026-05-29T02:30:00Z&capacity=0",
      await managerToken(),
    )

    expect(response.status).toBe(200)

    const parsed = z.array(roomAvailabilityResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(5)

      const roomOne = parsed.data.find((row) => row.room.id === 1)

      expect(roomOne?.room.name).toBe("Large Meeting Room A")
      expect(roomOne?.room.capacity).toBe(20)
      expect(roomOne?.available).toBe(false)
      expect(roomOne?.conflicts[0]?.startAt).toBe("2026-05-29T01:00:00Z")
      expect(roomOne?.conflicts[0]?.endAt).toBe("2026-05-29T02:00:00Z")

      const roomFour = parsed.data.find((row) => row.room.id === 4)

      expect(roomFour?.available).toBe(true)
      expect(roomFour?.conflicts.length).toBe(0)
    }
  })

  test("filters rooms by minimum capacity", async () => {
    const response = await getRequest(
      "/rooms/availability?start_at=2026-05-29T01:30:00Z&end_at=2026-05-29T02:30:00Z&capacity=10",
      await managerToken(),
    )

    expect(response.status).toBe(200)

    const parsed = z.array(roomAvailabilityResponseSchema).safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.length).toBe(2)
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest(
      "/rooms/availability?start_at=2026-05-29T01:30:00Z&end_at=2026-05-29T02:30:00Z&capacity=0",
      null,
    )

    expect(response.status).toBe(401)
  })

  test("returns 400 when start_at is missing", async () => {
    const response = await getRequest(
      "/rooms/availability?end_at=2026-05-29T02:30:00Z",
      await managerToken(),
    )

    expect(response.status).toBe(400)
  })
})
