import { RoomReservation } from "@/domain/room/room-reservation"
import { RoomReservationRepository } from "@/infrastructure/room/room-reservation-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("RoomReservationRepository", () => {
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
