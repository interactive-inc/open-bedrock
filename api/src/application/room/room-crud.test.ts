import { describe, expect, test } from "bun:test"
import { Room } from "@/domain/room/room.entity"
import { RoomReservation } from "@/domain/room/room-reservation.entity"
import { RegisterRoom } from "@/application/room/register-room"
import { GetRoom } from "@/application/room/get-room"
import { UpdateRoom } from "@/application/room/update-room"
import { DeleteRoom } from "@/application/room/delete-room"
import { ListRooms } from "@/application/room/list-rooms"
import { CreateRoomReservation } from "@/application/room/create-room-reservation"
import { GetRoomReservation } from "@/application/room/get-room-reservation"
import { UpdateRoomReservation } from "@/application/room/update-room-reservation"
import { CancelRoomReservation } from "@/application/room/cancel-room-reservation"
import { ListMyRoomReservations } from "@/application/room/list-my-room-reservations"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
import type { Context } from "@/env"

async function seedRoom(context: Context): Promise<Room> {
  const result = await new RegisterRoom(context).run({
    session: makeTestSession("admin"),
    room: { name: "Room A", capacity: 10, location: "3F" },
  })

  if (result instanceof Error) {
    throw new Error("seed room failed")
  }

  return result
}

async function seedReservation(
  context: Context,
  roomId: number,
  reserverId: number,
): Promise<RoomReservation> {
  const result = await new CreateRoomReservation(context).run({
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
    const { context } = createTestContext()

    const result = await new RegisterRoom(context).run({
      session: makeTestSession("admin"),
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
    const { context } = createTestContext()

    const result = await new RegisterRoom(context).run({
      session: makeTestSession("member"),
      room: { name: "Room A", capacity: 10, location: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("GetRoom", () => {
  test("returns the room by id", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)

    const result = await new GetRoom(context).run({ roomId: room.id })

    expect(result).toBeInstanceOf(Room)
  })

  test("rejects unknown id with room_not_found", async () => {
    const { context } = createTestContext()

    const result = await new GetRoom(context).run({ roomId: 9999 })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })
})

describe("UpdateRoom", () => {
  test("updates the room as admin", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)

    const result = await new UpdateRoom(context).run({
      session: makeTestSession("admin"),
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
    const { context } = createTestContext()
    const room = await seedRoom(context)

    const result = await new UpdateRoom(context).run({
      session: makeTestSession("member"),
      roomId: room.id,
      details: { name: "Hijacked", capacity: 1, location: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with room_not_found", async () => {
    const { context } = createTestContext()

    const result = await new UpdateRoom(context).run({
      session: makeTestSession("admin"),
      roomId: 9999,
      details: { name: "Missing", capacity: 1, location: null },
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })
})

describe("DeleteRoom", () => {
  test("deletes the room as admin", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)

    const result = await new DeleteRoom(context).run({
      session: makeTestSession("admin"),
      roomId: room.id,
    })

    expect(result).toEqual({ reason: "deleted" })
  })

  test("rejects member with forbidden", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)

    const result = await new DeleteRoom(context).run({
      session: makeTestSession("member"),
      roomId: room.id,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with room_not_found", async () => {
    const { context } = createTestContext()

    const result = await new DeleteRoom(context).run({
      session: makeTestSession("admin"),
      roomId: 9999,
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })
})

describe("ListRooms", () => {
  test("returns all rooms", async () => {
    const { context } = createTestContext()

    await seedRoom(context)

    await new RegisterRoom(context).run({
      session: makeTestSession("admin"),
      room: { name: "Room B", capacity: 5, location: null },
    })

    const result = await new ListRooms(context).run({ limit: 50, offset: 0 })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(2)
  })

  test("returns empty list when no rooms exist", async () => {
    const { context } = createTestContext()

    const result = await new ListRooms(context).run({ limit: 50, offset: 0 })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(0)
  })
})

describe("CreateRoomReservation", () => {
  test("creates a reservation", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)

    const result = await new CreateRoomReservation(context).run({
      roomId: room.id,
      reserverId: 1,
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
    const { context } = createTestContext()
    const room = await seedRoom(context)

    const result = await new CreateRoomReservation(context).run({
      roomId: room.id,
      reserverId: 1,
      startAt: "2026-06-01T12:00:00.000Z",
      endAt: "2026-06-01T10:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ValidationError, "invalid_time_range")
  })

  test("rejects start in past", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)

    const result = await new CreateRoomReservation(context).run({
      roomId: room.id,
      reserverId: 1,
      startAt: "2025-12-31T10:00:00.000Z",
      endAt: "2025-12-31T11:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, UnprocessableError, "start_in_past")
  })

  test("rejects unknown room with room_not_found", async () => {
    const { context } = createTestContext()

    const result = await new CreateRoomReservation(context).run({
      roomId: 9999,
      reserverId: 1,
      startAt: "2026-06-01T10:00:00.000Z",
      endAt: "2026-06-01T11:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })

  test("rejects overlapping reservation with room_already_reserved", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)

    await seedReservation(context, room.id, 1)

    const result = await new CreateRoomReservation(context).run({
      roomId: room.id,
      reserverId: 2,
      startAt: "2026-06-01T10:30:00.000Z",
      endAt: "2026-06-01T11:30:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ConflictError, "room_already_reserved")
  })
})

describe("GetRoomReservation", () => {
  test("returns the reservation for the reserver", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)
    const reservation = await seedReservation(context, room.id, 1)

    const result = await new GetRoomReservation(context).run({
      reservationId: reservation.id,
      reserverId: 1,
    })

    expect(result).toBeInstanceOf(RoomReservation)
  })

  test("rejects non-reserver with not_reserver", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)
    const reservation = await seedReservation(context, room.id, 1)

    const result = await new GetRoomReservation(context).run({
      reservationId: reservation.id,
      reserverId: 999,
    })

    expectApplicationError(result, ForbiddenError, "not_reserver")
  })

  test("rejects unknown id with reservation_not_found", async () => {
    const { context } = createTestContext()

    const result = await new GetRoomReservation(context).run({
      reservationId: "00000000-0000-0000-0000-000000000000",
      reserverId: 1,
    })

    expectApplicationError(result, NotFoundError, "reservation_not_found")
  })
})

describe("UpdateRoomReservation", () => {
  test("updates the reservation for the reserver", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)
    const reservation = await seedReservation(context, room.id, 1)

    const result = await new UpdateRoomReservation(context).run({
      reservationId: reservation.id,
      reserverId: 1,
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
    const { context } = createTestContext()
    const room = await seedRoom(context)
    const reservation = await seedReservation(context, room.id, 1)

    const result = await new UpdateRoomReservation(context).run({
      reservationId: reservation.id,
      reserverId: 999,
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T15:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ForbiddenError, "not_reserver")
  })

  test("rejects invalid time range", async () => {
    const { context } = createTestContext()

    const result = await new UpdateRoomReservation(context).run({
      reservationId: "some-id",
      reserverId: 1,
      startAt: "2026-06-01T15:00:00.000Z",
      endAt: "2026-06-01T14:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ValidationError, "invalid_time_range")
  })
})

describe("CancelRoomReservation", () => {
  test("cancels the reservation for the reserver", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)
    const reservation = await seedReservation(context, room.id, 1)

    const result = await new CancelRoomReservation(context).run({
      reservationId: reservation.id,
      reserverId: 1,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects non-reserver or unknown id with reservation_not_found", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)
    const reservation = await seedReservation(context, room.id, 1)

    const result = await new CancelRoomReservation(context).run({
      reservationId: reservation.id,
      reserverId: 999,
    })

    expectApplicationError(result, NotFoundError, "reservation_not_found")
  })
})

describe("ListMyRoomReservations", () => {
  test("returns reservations for the reserver", async () => {
    const { context } = createTestContext()
    const room = await seedRoom(context)

    await seedReservation(context, room.id, 1)

    await new CreateRoomReservation(context).run({
      roomId: room.id,
      reserverId: 1,
      startAt: "2026-06-02T10:00:00.000Z",
      endAt: "2026-06-02T11:00:00.000Z",
      purpose: null,
    })

    const result = await new ListMyRoomReservations(context).run({
      reserverId: 1,
      limit: 50,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(2)
  })

  test("returns empty list when no reservations exist", async () => {
    const { context } = createTestContext()

    const result = await new ListMyRoomReservations(context).run({
      reserverId: 1,
      limit: 50,
      offset: 0,
    })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(0)
  })
})
