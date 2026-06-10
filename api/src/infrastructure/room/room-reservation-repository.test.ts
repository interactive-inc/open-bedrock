import { RoomReservation } from "@/domain/room/room-reservation"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("RoomReservationRepository", () => {
  test("createIfNoOverlap succeeds when no overlapping reservation exists", async () => {
    const { context } = createTestContext()

    const repository = new RoomReservationRepository(context)

    const reservation = RoomReservation.create({
      roomId: 1,
      reserverId: 1,
      startAt: "2026-01-01T10:00:00.000Z",
      endAt: "2026-01-01T11:00:00.000Z",
      purpose: "定例会議",
    })

    const result = await repository.createIfNoOverlap(reservation)

    expect(result).toBeInstanceOf(RoomReservation)

    if (result instanceof Error || result === null) {
      throw new Error("expected reservation but got null or Error")
    }

    expect(result.id).toBe(reservation.id)
    expect(result.roomId).toBe(1)
  })

  test("createIfNoOverlap returns null when overlapping reservation exists", async () => {
    const { context } = createTestContext()

    const repository = new RoomReservationRepository(context)

    const existing = RoomReservation.create({
      roomId: 1,
      reserverId: 1,
      startAt: "2026-01-01T10:00:00.000Z",
      endAt: "2026-01-01T11:00:00.000Z",
      purpose: "既存予約",
    })

    const created = await repository.create(existing)

    if (created instanceof Error) {
      throw created
    }

    const overlapping = RoomReservation.create({
      roomId: 1,
      reserverId: 2,
      startAt: "2026-01-01T10:30:00.000Z",
      endAt: "2026-01-01T11:30:00.000Z",
      purpose: "重複予約",
    })

    const result = await repository.createIfNoOverlap(overlapping)

    expect(result).toBeNull()
  })

  test("create then findOverlapping returns the saved reservation", async () => {
    const { context } = createTestContext()

    const repository = new RoomReservationRepository(context)

    const reservation = RoomReservation.create({
      roomId: 1,
      reserverId: 1,
      startAt: "2026-01-01T10:00:00.000Z",
      endAt: "2026-01-01T11:00:00.000Z",
      purpose: "定例会議",
    })

    const created = await repository.create(reservation)

    expect(created).toBeInstanceOf(RoomReservation)

    if (created instanceof Error) {
      throw created
    }

    const overlapping = await repository.findOverlapping({
      roomId: 1,
      startAt: "2026-01-01T10:30:00.000Z",
      endAt: "2026-01-01T11:30:00.000Z",
      excludeReservationId: null,
    })

    expect(overlapping).not.toBeInstanceOf(Error)

    if (overlapping instanceof Error) {
      throw overlapping
    }

    expect(overlapping.length).toBe(1)
    expect(overlapping[0]?.id).toBe(reservation.id)
  })
})
