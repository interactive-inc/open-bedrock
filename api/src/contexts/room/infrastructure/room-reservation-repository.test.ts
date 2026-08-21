import { RoomReservation } from "@/contexts/room/domain/room-reservation.entity"
import { RoomReservationRepository } from "@/contexts/room/infrastructure/room-reservation.repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import { describe, expect, test } from "bun:test"

function createReservation(props: Parameters<typeof RoomReservation.create>[0]): RoomReservation {
  const result = RoomReservation.create(props)
  if ("reason" in result) throw new Error("unexpected invalid_time_range in test")
  return result
}

describe("RoomReservationRepository", () => {
  test("createIfNoOverlap succeeds when no overlapping reservation exists", async () => {
    const { context } = createTestContext()

    const repository = new RoomReservationRepository(context)

    const reservation = createReservation({
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

    const existing = createReservation({
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

    const overlapping = createReservation({
      roomId: 1,
      reserverId: 2,
      startAt: "2026-01-01T10:30:00.000Z",
      endAt: "2026-01-01T11:30:00.000Z",
      purpose: "重複予約",
    })

    const result = await repository.createIfNoOverlap(overlapping)

    expect(result).toBeNull()
  })

  test("updateIfNoOverlap succeeds when no overlapping reservation exists", async () => {
    const { context } = createTestContext()

    const repository = new RoomReservationRepository(context)

    const reservation = createReservation({
      roomId: 1,
      reserverId: 1,
      startAt: "2026-01-01T10:00:00.000Z",
      endAt: "2026-01-01T11:00:00.000Z",
      purpose: "定例会議",
    })

    const created = await repository.create(reservation)

    if (created instanceof Error) {
      throw created
    }

    const rescheduled = reservation.withRescheduled({
      startAt: "2026-01-01T14:00:00.000Z",
      endAt: "2026-01-01T15:00:00.000Z",
    })
    if ("reason" in rescheduled) throw new Error("unexpected invalid_time_range")
    const updated = rescheduled.withPurpose("時間変更後の会議")

    const result = await repository.updateIfNoOverlap(updated)

    expect(result).toBeInstanceOf(RoomReservation)

    if (result instanceof Error || result === null) {
      throw new Error("expected reservation but got null or Error")
    }

    expect(result.id).toBe(reservation.id)
    expect(result.startAt).toBe("2026-01-01T14:00:00.000Z")
    expect(result.endAt).toBe("2026-01-01T15:00:00.000Z")
    expect(result.purpose).toBe("時間変更後の会議")
  })

  test("updateIfNoOverlap returns null when overlapping reservation exists", async () => {
    const { context } = createTestContext()

    const repository = new RoomReservationRepository(context)

    const existing = createReservation({
      roomId: 1,
      reserverId: 2,
      startAt: "2026-01-01T14:00:00.000Z",
      endAt: "2026-01-01T15:00:00.000Z",
      purpose: "他の人の予約",
    })

    const createdExisting = await repository.create(existing)

    if (createdExisting instanceof Error) {
      throw createdExisting
    }

    const target = createReservation({
      roomId: 1,
      reserverId: 1,
      startAt: "2026-01-01T10:00:00.000Z",
      endAt: "2026-01-01T11:00:00.000Z",
      purpose: "自分の予約",
    })

    const createdTarget = await repository.create(target)

    if (createdTarget instanceof Error) {
      throw createdTarget
    }

    const rescheduledTarget = target.withRescheduled({
      startAt: "2026-01-01T14:30:00.000Z",
      endAt: "2026-01-01T15:30:00.000Z",
    })
    if ("reason" in rescheduledTarget) throw new Error("unexpected invalid_time_range")
    const updatedTarget = rescheduledTarget.withPurpose("時間変更")

    const result = await repository.updateIfNoOverlap(updatedTarget)

    expect(result).toBeNull()
  })

  test("create then findOverlapping returns the saved reservation", async () => {
    const { context } = createTestContext()

    const repository = new RoomReservationRepository(context)

    const reservation = createReservation({
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
