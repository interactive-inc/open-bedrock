import { describe, expect, test } from "bun:test"
import { seedEmployees } from "@/contexts/company-compatibility/infrastructure/seed/seed-employees"
import { seedRooms } from "@/contexts/room/infrastructure/seed/seed-rooms"
import { createTestToken } from "@/api/test/support/create-test-token"
import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { loadSchema } from "@/api/test/support/load-schema"
import { requestWithContext } from "@/api/test/support/request-with-context"
import { seedD1 } from "@/api/test/support/seed-d1"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { z } from "zod"

const roomReservationResponseSchema = z.object({
  id: z.string(),
  room_id: z.number(),
  reserver_id: z.number(),
  start_at: z.string(),
  end_at: z.string(),
  purpose: z.string().nullable(),
})

const jwtSecret = "room-reservations-me-route-test-secret"

/** employee 4 が 3 件の予約を持つテスト DB を構築する。 */
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
    "rooms",
    seedRooms.map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      location: room.location,
    })),
  )

  // employee 4 の予約を 3 件挿入する
  await seedD1(db, "room_reservations", [
    {
      id: "aaaaaaaa-0000-0000-0000-000000000001",
      room_id: 1,
      reserver_id: 4,
      start_at: "2026-06-01T01:00:00Z",
      end_at: "2026-06-01T02:00:00Z",
      purpose: "Standup",
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000002",
      room_id: 2,
      reserver_id: 4,
      start_at: "2026-06-02T01:00:00Z",
      end_at: "2026-06-02T02:00:00Z",
      purpose: "Retro",
    },
    {
      id: "aaaaaaaa-0000-0000-0000-000000000003",
      room_id: 1,
      reserver_id: 4,
      start_at: "2026-06-03T01:00:00Z",
      end_at: "2026-06-03T02:00:00Z",
      purpose: "Planning",
    },
  ])

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

describe("GET /rooms/reservations/me", () => {
  test("returns the caller's reservations", async () => {
    const response = await getRequest("/rooms/reservations/me", await managerToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomReservationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(3)
    }
  })

  test("applies limit=1 and returns only 1 item", async () => {
    const response = await getRequest("/rooms/reservations/me?limit=1", await managerToken())

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomReservationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      // start_at 昇順なので最初の予約が返る
      expect(parsed.data.data[0]?.purpose).toBe("Standup")
    }
  })

  test("applies offset to skip items", async () => {
    const response = await getRequest(
      "/rooms/reservations/me?limit=1&offset=1",
      await managerToken(),
    )

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomReservationResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
      expect(parsed.data.data[0]?.purpose).toBe("Retro")
    }
  })

  test("returns 401 without a bearer token", async () => {
    const response = await getRequest("/rooms/reservations/me", null)

    expect(response.status).toBe(401)
  })
})
