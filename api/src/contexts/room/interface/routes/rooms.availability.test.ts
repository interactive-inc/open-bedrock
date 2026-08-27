import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
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

describe("GET /rooms/availability", () => {
  test("returns 200 with the nested room shape the CLI table expects", async () => {
    const response = await getRequest(
      "/rooms/availability?start_at=2026-05-29T01:30:00Z&end_at=2026-05-29T02:30:00Z&capacity=0",
      await managerToken(),
    )

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomAvailabilityResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(5)

      const roomOne = parsed.data.data.find((row) => row.room.id === 1)

      expect(roomOne?.room.name).toBe("大会議室A")
      expect(roomOne?.room.capacity).toBe(20)
      expect(roomOne?.available).toBe(false)
      expect(roomOne?.conflicts[0]?.startAt).toBe("2026-05-29T01:00:00Z")
      expect(roomOne?.conflicts[0]?.endAt).toBe("2026-05-29T02:00:00Z")

      const roomFour = parsed.data.data.find((row) => row.room.id === 4)

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

    const parsed = z
      .object({ data: z.array(roomAvailabilityResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)
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

  test("?limit=1 returns only 1 room when seed has 5 matching capacity=0", async () => {
    const response = await getRequest(
      "/rooms/availability?start_at=2026-05-29T01:30:00Z&end_at=2026-05-29T02:30:00Z&capacity=0&limit=1",
      await managerToken(),
    )

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomAvailabilityResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)
    }
  })

  test("includes all conflicts when a single room has multiple overlapping reservations", async () => {
    // Build a DB with one room that has two reservations both overlapping the query window.
    const db = createD1TestDatabase(loadSchema())

    await seedCompanyEmployees(db, [
      {
        id: 4,
        code: "E004",
        name: "Manager",
        deptId: 3,
        deptName: "開発部",
        position: "Manager",
        status: "active",
      },
    ])

    await seedIamForEmployees(db, [
      { id: 4, email: "you+e004@example.com", passwordHash: "hash", role: "manager" },
    ])

    await seedD1(db, "rooms", [{ id: 10, name: "Room Alpha", capacity: 5, location: null }])

    await seedD1(db, "room_reservations", [
      {
        id: "10000000-0000-0000-0000-000000000001",
        room_id: 10,
        reserver_id: "4",
        start_at: "2026-06-01T09:00:00Z",
        end_at: "2026-06-01T10:00:00Z",
        purpose: "First overlap",
      },
      {
        id: "10000000-0000-0000-0000-000000000002",
        room_id: 10,
        reserver_id: "4",
        start_at: "2026-06-01T09:30:00Z",
        end_at: "2026-06-01T10:30:00Z",
        purpose: "Second overlap",
      },
    ])
    await initializeStandardCompanyTestState(db)

    const token = await managerToken()
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/rooms/availability?start_at=2026-06-01T09:15:00Z&end_at=2026-06-01T10:15:00Z&capacity=0",
      token,
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomAvailabilityResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(1)

      const roomAlpha = parsed.data.data.find((row) => row.room.id === 10)

      expect(roomAlpha?.available).toBe(false)
      expect(roomAlpha?.conflicts.length).toBe(2)

      const startTimes = roomAlpha?.conflicts.map((c) => c.startAt).sort() ?? []

      expect(startTimes).toEqual(["2026-06-01T09:00:00Z", "2026-06-01T09:30:00Z"])
    }
  })

  test("groups conflicts correctly when multiple rooms each have overlapping reservations", async () => {
    // Build a DB with two rooms, each having a distinct set of overlapping reservations.
    const db = createD1TestDatabase(loadSchema())

    await seedCompanyEmployees(db, [
      {
        id: 4,
        code: "E004",
        name: "Manager",
        deptId: 3,
        deptName: "開発部",
        position: "Manager",
        status: "active",
      },
    ])

    await seedIamForEmployees(db, [
      { id: 4, email: "you+e004@example.com", passwordHash: "hash", role: "manager" },
    ])

    await seedD1(db, "rooms", [
      { id: 20, name: "Room Beta", capacity: 4, location: null },
      { id: 21, name: "Room Gamma", capacity: 4, location: null },
    ])

    await seedD1(db, "room_reservations", [
      // Room Beta: two conflicts
      {
        id: "20000000-0000-0000-0000-000000000001",
        room_id: 20,
        reserver_id: "4",
        start_at: "2026-06-02T10:00:00Z",
        end_at: "2026-06-02T11:00:00Z",
        purpose: "Beta conflict 1",
      },
      {
        id: "20000000-0000-0000-0000-000000000002",
        room_id: 20,
        reserver_id: "4",
        start_at: "2026-06-02T10:30:00Z",
        end_at: "2026-06-02T11:30:00Z",
        purpose: "Beta conflict 2",
      },
      // Room Gamma: one conflict
      {
        id: "20000000-0000-0000-0000-000000000003",
        room_id: 21,
        reserver_id: "4",
        start_at: "2026-06-02T10:15:00Z",
        end_at: "2026-06-02T10:45:00Z",
        purpose: "Gamma conflict 1",
      },
    ])
    await initializeStandardCompanyTestState(db)

    const token = await managerToken()
    const response = await requestWithContext({
      db,
      jwtSecret,
      path: "/rooms/availability?start_at=2026-06-02T10:00:00Z&end_at=2026-06-02T11:30:00Z&capacity=0",
      token,
    })

    expect(response.status).toBe(200)

    const parsed = z
      .object({ data: z.array(roomAvailabilityResponseSchema), total: z.number() })
      .safeParse(await response.json())

    expect(parsed.success).toBe(true)

    if (parsed.success) {
      expect(parsed.data.data.length).toBe(2)

      const roomBeta = parsed.data.data.find((row) => row.room.id === 20)

      expect(roomBeta?.available).toBe(false)
      expect(roomBeta?.conflicts.length).toBe(2)

      const betaStartTimes = roomBeta?.conflicts.map((c) => c.startAt).sort() ?? []

      expect(betaStartTimes).toEqual(["2026-06-02T10:00:00Z", "2026-06-02T10:30:00Z"])

      const roomGamma = parsed.data.data.find((row) => row.room.id === 21)

      expect(roomGamma?.available).toBe(false)
      expect(roomGamma?.conflicts.length).toBe(1)
      expect(roomGamma?.conflicts[0]?.startAt).toBe("2026-06-02T10:15:00Z")
    }
  })
})
