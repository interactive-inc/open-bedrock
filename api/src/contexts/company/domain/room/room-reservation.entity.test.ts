import { RoomReservation } from "@/contexts/company/domain/room/room-reservation.entity"
import { describe, expect, test } from "bun:test"

describe("RoomReservation.create", () => {
  test("with valid time range builds reservation", () => {
    const reservation = RoomReservation.create({
      roomId: 1,
      reserverId: 10,
      startAt: "2026-06-11T10:00:00.000Z",
      endAt: "2026-06-11T11:00:00.000Z",
      purpose: "定例会議",
    })

    expect(reservation).toBeInstanceOf(RoomReservation)

    if ("reason" in reservation) {
      throw new Error(reservation.reason)
    }

    expect(reservation.roomId).toBe(1)
    expect(reservation.reserverId).toBe(10)
    expect(reservation.startAt).toBe("2026-06-11T10:00:00.000Z")
    expect(reservation.endAt).toBe("2026-06-11T11:00:00.000Z")
    expect(reservation.purpose).toBe("定例会議")
  })

  test("with startAt equal to endAt returns invalid_time_range", () => {
    const reservation = RoomReservation.create({
      roomId: 1,
      reserverId: 10,
      startAt: "2026-06-11T10:00:00.000Z",
      endAt: "2026-06-11T10:00:00.000Z",
      purpose: null,
    })

    expect(reservation).not.toBeInstanceOf(RoomReservation)
    expect("reason" in reservation).toBe(true)

    if (!("reason" in reservation)) {
      throw new Error("expected invalid_time_range")
    }

    expect(reservation.reason).toBe("invalid_time_range")
  })

  test("with startAt after endAt returns invalid_time_range", () => {
    const reservation = RoomReservation.create({
      roomId: 1,
      reserverId: 10,
      startAt: "2026-06-11T12:00:00.000Z",
      endAt: "2026-06-11T11:00:00.000Z",
      purpose: null,
    })

    expect("reason" in reservation).toBe(true)
  })
})

describe("RoomReservation.fromRow", () => {
  test("with valid data returns RoomReservation", () => {
    const reservation = RoomReservation.fromRow({
      id: "550e8400-e29b-41d4-a716-446655440000",
      roomId: 1,
      reserverId: 10,
      startAt: "2026-06-11T10:00:00.000Z",
      endAt: "2026-06-11T11:00:00.000Z",
      purpose: "面談",
    })

    expect(reservation).toBeInstanceOf(RoomReservation)

    if (reservation instanceof Error) {
      throw reservation
    }

    expect(reservation.id).toBe("550e8400-e29b-41d4-a716-446655440000")
    expect(reservation.purpose).toBe("面談")
  })

  test("with startAt >= endAt returns Error", () => {
    const reservation = RoomReservation.fromRow({
      id: "550e8400-e29b-41d4-a716-446655440000",
      roomId: 1,
      reserverId: 10,
      startAt: "2026-06-11T12:00:00.000Z",
      endAt: "2026-06-11T11:00:00.000Z",
      purpose: null,
    })

    expect(reservation).toBeInstanceOf(Error)
  })
})

describe("RoomReservation.withPurpose", () => {
  test("returns new reservation with changed purpose", () => {
    const reservation = RoomReservation.create({
      roomId: 1,
      reserverId: 10,
      startAt: "2026-06-11T10:00:00.000Z",
      endAt: "2026-06-11T11:00:00.000Z",
      purpose: "定例会議",
    })

    if ("reason" in reservation) {
      throw new Error(reservation.reason)
    }

    const updated = reservation.withPurpose("臨時会議")

    expect(updated).toBeInstanceOf(RoomReservation)
    expect(updated.purpose).toBe("臨時会議")
    expect(updated.roomId).toBe(1)
  })
})

describe("RoomReservation.withRescheduled", () => {
  test("with valid range returns new reservation", () => {
    const reservation = RoomReservation.create({
      roomId: 1,
      reserverId: 10,
      startAt: "2026-06-11T10:00:00.000Z",
      endAt: "2026-06-11T11:00:00.000Z",
      purpose: null,
    })

    if ("reason" in reservation) {
      throw new Error(reservation.reason)
    }

    const rescheduled = reservation.withRescheduled({
      startAt: "2026-06-11T14:00:00.000Z",
      endAt: "2026-06-11T15:00:00.000Z",
    })

    expect(rescheduled).toBeInstanceOf(RoomReservation)

    if ("reason" in rescheduled) {
      throw new Error(rescheduled.reason)
    }

    expect(rescheduled.startAt).toBe("2026-06-11T14:00:00.000Z")
    expect(rescheduled.endAt).toBe("2026-06-11T15:00:00.000Z")
  })

  test("with invalid range returns invalid_time_range", () => {
    const reservation = RoomReservation.create({
      roomId: 1,
      reserverId: 10,
      startAt: "2026-06-11T10:00:00.000Z",
      endAt: "2026-06-11T11:00:00.000Z",
      purpose: null,
    })

    if ("reason" in reservation) {
      throw new Error(reservation.reason)
    }

    const rescheduled = reservation.withRescheduled({
      startAt: "2026-06-11T15:00:00.000Z",
      endAt: "2026-06-11T14:00:00.000Z",
    })

    expect("reason" in rescheduled).toBe(true)

    if (!("reason" in rescheduled)) {
      throw new Error("expected invalid_time_range")
    }

    expect(rescheduled.reason).toBe("invalid_time_range")
  })
})
