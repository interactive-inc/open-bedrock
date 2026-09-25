import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"
import { Room } from "@/contexts/room/domain/entities/room.entity"
import { RoomReservation } from "@/contexts/room/domain/entities/room-reservation.entity"
import { RegisterRoom } from "@/contexts/room/application/register-room"
import { UpdateRoom } from "@/contexts/room/application/update-room"
import { DeleteRoom } from "@/contexts/room/application/delete-room"
import { CreateRoomReservation } from "@/contexts/room/application/create-room-reservation"
import { UpdateRoomReservation } from "@/contexts/room/application/update-room-reservation"
import { makeTestSession } from "@tests/api/support/make-test-session"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

const now = "2026-01-01T00:00:00.000Z"

/**
 * 会議室と予約のRepositoryを型付きfakeにする。採番、batch削除、重複判定の条件付きSQLは
 * room.repository.d1.test.tsとroom-reservation.repository.test.tsが検証する。
 */
function createRepositories() {
  const rooms = new Map<string, Room>()
  const reservations = new Map<string, RoomReservation>()

  const overlaps = (candidate: RoomReservation) =>
    [...reservations.values()].some(
      (row) =>
        row.id !== candidate.id &&
        row.roomId === candidate.roomId &&
        row.startAt < candidate.endAt &&
        candidate.startAt < row.endAt,
    )

  const roomRepository = {
    findById: async (id: string) => rooms.get(id) ?? null,
    create: async (room: { name: string; capacity: number; location: string | null }) => {
      const created = new Room({ id: crypto.randomUUID(), ...room })
      rooms.set(created.id, created)
      return created
    },
    update: async (room: Room) => {
      if (!rooms.has(room.id)) return null
      rooms.set(room.id, room)
      return room
    },
    deleteWithReservations: async (room: Room): Promise<true | null> => {
      for (const reservation of reservations.values()) {
        if (reservation.roomId === room.id) reservations.delete(reservation.id)
      }
      return rooms.delete(room.id) ? true : null
    },
  }

  const reservationRepository = {
    findById: async (id: string) => reservations.get(id) ?? null,
    createIfNoOverlap: async (reservation: RoomReservation) => {
      if (overlaps(reservation)) return null
      reservations.set(reservation.id, reservation)
      return reservation
    },
    updateIfNoOverlap: async (reservation: RoomReservation) => {
      if (!reservations.has(reservation.id) || overlaps(reservation)) return null
      reservations.set(reservation.id, reservation)
      return reservation
    },
  }

  return { rooms, reservations, roomRepository, reservationRepository }
}

type Repositories = ReturnType<typeof createRepositories>

async function seedRoom(repositories: Repositories): Promise<Room> {
  const result = await new RegisterRoom(repositories).run({
    session: makeTestSession("root"),
    room: { name: "Room A", capacity: 10, location: "3F" },
  })

  if (result instanceof Error) {
    throw new Error("seed room failed")
  }

  return result
}

async function seedReservation(
  repositories: Repositories,
  roomId: string,
  reserverId: EmployeeId,
): Promise<RoomReservation> {
  const result = await new CreateRoomReservation({ ...repositories, now }).run({
    roomId: roomId,
    reserverId: reserverId,
    startAt: "2026-06-01T10:00:00.000Z",
    endAt: "2026-06-01T11:00:00.000Z",
    purpose: "Meeting",
  })

  if (result instanceof Error) {
    throw new Error("seed reservation failed")
  }

  return result
}

describe("RegisterRoom", () => {
  test("registers a room as admin", async () => {
    const repositories = createRepositories()

    const result = await new RegisterRoom(repositories).run({
      session: makeTestSession("root"),
      room: { name: "Room A", capacity: 10, location: "3F" },
    })

    expect(result).toBeInstanceOf(Room)

    if (result instanceof Error) {
      throw new Error("register failed")
    }

    expect(result.name).toBe("Room A")
    expect(result.capacity).toBe(10)
  })

  test("rejects member with forbidden", async () => {
    const repositories = createRepositories()

    const result = await new RegisterRoom(repositories).run({
      session: makeTestSession("member"),
      room: { name: "Room A", capacity: 10, location: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
    expect(repositories.rooms.size).toBe(0)
  })
})

describe("UpdateRoom", () => {
  test("updates the room as admin", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)

    const result = await new UpdateRoom(repositories).run({
      session: makeTestSession("root"),
      roomId: room.id,
      details: { name: "Updated Room", capacity: 20, location: "5F" },
    })

    expect(result).toBeInstanceOf(Room)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.name).toBe("Updated Room")
    expect(result.capacity).toBe(20)
  })

  test("rejects member with forbidden", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)

    const result = await new UpdateRoom(repositories).run({
      session: makeTestSession("member"),
      roomId: room.id,
      details: { name: "Hijacked", capacity: 1, location: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
    expect(repositories.rooms.get(room.id)?.name).toBe("Room A")
  })

  test("rejects unknown id with room_not_found", async () => {
    const repositories = createRepositories()

    const result = await new UpdateRoom(repositories).run({
      session: makeTestSession("root"),
      roomId: "01900022-0000-7000-8000-00000000270f",
      details: { name: "Missing", capacity: 1, location: null },
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })
})

describe("DeleteRoom", () => {
  test("deletes the room as admin", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)

    const result = await new DeleteRoom(repositories).run({
      session: makeTestSession("root"),
      roomId: room.id,
    })

    expect(result).toEqual({ reason: "deleted" })
    expect(repositories.rooms.has(room.id)).toBe(false)
  })

  test("rejects member with forbidden", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)

    const result = await new DeleteRoom(repositories).run({
      session: makeTestSession("member"),
      roomId: room.id,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
    expect(repositories.rooms.has(room.id)).toBe(true)
  })

  test("rejects unknown id with room_not_found", async () => {
    const repositories = createRepositories()

    const result = await new DeleteRoom(repositories).run({
      session: makeTestSession("root"),
      roomId: "01900022-0000-7000-8000-00000000270f",
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })
})

describe("CreateRoomReservation", () => {
  test("creates a reservation", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)

    const result = await new CreateRoomReservation({ ...repositories, now }).run({
      roomId: room.id,
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2026-06-01T10:00:00.000Z",
      endAt: "2026-06-01T11:00:00.000Z",
      purpose: "Weekly sync",
    })

    expect(result).toBeInstanceOf(RoomReservation)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.roomId).toBe(room.id)
  })

  test("rejects invalid time range", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)

    const result = await new CreateRoomReservation({ ...repositories, now }).run({
      roomId: room.id,
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2026-06-01T12:00:00.000Z",
      endAt: "2026-06-01T10:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ValidationError, "invalid_time_range")
  })

  test("rejects start in past", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)

    const result = await new CreateRoomReservation({ ...repositories, now }).run({
      roomId: room.id,
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2025-12-31T10:00:00.000Z",
      endAt: "2025-12-31T11:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, UnprocessableError, "start_in_past")
  })

  test("rejects unknown room with room_not_found", async () => {
    const repositories = createRepositories()

    const result = await new CreateRoomReservation({ ...repositories, now }).run({
      roomId: "01900022-0000-7000-8000-00000000270f",
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2026-06-01T10:00:00.000Z",
      endAt: "2026-06-01T11:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })

  test("rejects overlapping reservation with room_already_reserved", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)

    await seedReservation(repositories, room.id, toWorkforceEmployeeId(1))

    const result = await new CreateRoomReservation({ ...repositories, now }).run({
      roomId: room.id,
      reserverId: toWorkforceEmployeeId(2),
      startAt: "2026-06-01T10:30:00.000Z",
      endAt: "2026-06-01T11:30:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ConflictError, "room_already_reserved")
  })
})

describe("UpdateRoomReservation", () => {
  test("updates the reservation for the reserver", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)
    const reservation = await seedReservation(repositories, room.id, toWorkforceEmployeeId(1))

    const result = await new UpdateRoomReservation({ ...repositories, now }).run({
      reservationId: reservation.id,
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T15:00:00.000Z",
      purpose: "Updated meeting",
    })

    expect(result).toBeInstanceOf(RoomReservation)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.startAt).toBe("2026-06-01T14:00:00.000Z")
    expect(result.purpose).toBe("Updated meeting")
  })

  test("rejects non-reserver with not_reserver", async () => {
    const repositories = createRepositories()
    const room = await seedRoom(repositories)
    const reservation = await seedReservation(repositories, room.id, toWorkforceEmployeeId(1))

    const result = await new UpdateRoomReservation({ ...repositories, now }).run({
      reservationId: reservation.id,
      reserverId: toWorkforceEmployeeId(999),
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T15:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ForbiddenError, "not_reserver")
  })

  test("rejects invalid time range", async () => {
    const repositories = createRepositories()

    const result = await new UpdateRoomReservation({ ...repositories, now }).run({
      reservationId: "some-id",
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2026-06-01T15:00:00.000Z",
      endAt: "2026-06-01T14:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ValidationError, "invalid_time_range")
  })
})
