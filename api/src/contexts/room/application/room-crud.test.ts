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
import { createTestContext } from "@tests/api/support/create-test-context"
import { makeTestSession } from "@tests/api/support/make-test-session"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import type { Context } from "@/env"

async function seedRoom(context: Context): Promise<Room> {
  const result = await new RegisterRoom(context).run({
    session: makeTestSession("root"),
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
  reserverId: EmployeeId,
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
    const { context } = await createTestContext()

    const result = await new RegisterRoom(context).run({
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
    const { context } = await createTestContext()

    const result = await new RegisterRoom(context).run({
      session: makeTestSession("member"),
      room: { name: "Room A", capacity: 10, location: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })
})

describe("GetRoom", () => {})

describe("UpdateRoom", () => {
  test("updates the room as admin", async () => {
    const { context } = await createTestContext()
    const room = await seedRoom(context)

    const result = await new UpdateRoom(context).run({
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
    const { context } = await createTestContext()
    const room = await seedRoom(context)

    const result = await new UpdateRoom(context).run({
      session: makeTestSession("member"),
      roomId: room.id,
      details: { name: "Hijacked", capacity: 1, location: null },
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with room_not_found", async () => {
    const { context } = await createTestContext()

    const result = await new UpdateRoom(context).run({
      session: makeTestSession("root"),
      roomId: 9999,
      details: { name: "Missing", capacity: 1, location: null },
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })
})

describe("DeleteRoom", () => {
  test("deletes the room as admin", async () => {
    const { context } = await createTestContext()
    const room = await seedRoom(context)

    const result = await new DeleteRoom(context).run({
      session: makeTestSession("root"),
      roomId: room.id,
    })

    expect(result).toEqual({ reason: "deleted" })
  })

  test("rejects member with forbidden", async () => {
    const { context } = await createTestContext()
    const room = await seedRoom(context)

    const result = await new DeleteRoom(context).run({
      session: makeTestSession("member"),
      roomId: room.id,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects unknown id with room_not_found", async () => {
    const { context } = await createTestContext()

    const result = await new DeleteRoom(context).run({
      session: makeTestSession("root"),
      roomId: 9999,
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })
})

describe("ListRooms", () => {})

describe("CreateRoomReservation", () => {
  test("creates a reservation", async () => {
    const { context } = await createTestContext()
    const room = await seedRoom(context)

    const result = await new CreateRoomReservation(context).run({
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
    const { context } = await createTestContext()
    const room = await seedRoom(context)

    const result = await new CreateRoomReservation(context).run({
      roomId: room.id,
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2026-06-01T12:00:00.000Z",
      endAt: "2026-06-01T10:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ValidationError, "invalid_time_range")
  })

  test("rejects start in past", async () => {
    const { context } = await createTestContext()
    const room = await seedRoom(context)

    const result = await new CreateRoomReservation(context).run({
      roomId: room.id,
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2025-12-31T10:00:00.000Z",
      endAt: "2025-12-31T11:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, UnprocessableError, "start_in_past")
  })

  test("rejects unknown room with room_not_found", async () => {
    const { context } = await createTestContext()

    const result = await new CreateRoomReservation(context).run({
      roomId: 9999,
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2026-06-01T10:00:00.000Z",
      endAt: "2026-06-01T11:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, NotFoundError, "room_not_found")
  })

  test("rejects overlapping reservation with room_already_reserved", async () => {
    const { context } = await createTestContext()
    const room = await seedRoom(context)

    await seedReservation(context, room.id, toWorkforceEmployeeId(1))

    const result = await new CreateRoomReservation(context).run({
      roomId: room.id,
      reserverId: toWorkforceEmployeeId(2),
      startAt: "2026-06-01T10:30:00.000Z",
      endAt: "2026-06-01T11:30:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ConflictError, "room_already_reserved")
  })
})

describe("GetRoomReservation", () => {})

describe("UpdateRoomReservation", () => {
  test("updates the reservation for the reserver", async () => {
    const { context } = await createTestContext()
    const room = await seedRoom(context)
    const reservation = await seedReservation(context, room.id, toWorkforceEmployeeId(1))

    const result = await new UpdateRoomReservation(context).run({
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
    const { context } = await createTestContext()
    const room = await seedRoom(context)
    const reservation = await seedReservation(context, room.id, toWorkforceEmployeeId(1))

    const result = await new UpdateRoomReservation(context).run({
      reservationId: reservation.id,
      reserverId: toWorkforceEmployeeId(999),
      startAt: "2026-06-01T14:00:00.000Z",
      endAt: "2026-06-01T15:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ForbiddenError, "not_reserver")
  })

  test("rejects invalid time range", async () => {
    const { context } = await createTestContext()

    const result = await new UpdateRoomReservation(context).run({
      reservationId: "some-id",
      reserverId: toWorkforceEmployeeId(1),
      startAt: "2026-06-01T15:00:00.000Z",
      endAt: "2026-06-01T14:00:00.000Z",
      purpose: null,
    })

    expectApplicationError(result, ValidationError, "invalid_time_range")
  })
})

describe("CancelRoomReservation", () => {})

describe("ListMyRoomReservations", () => {})
