import { RentalReservation } from "@/domain/rental/rental-reservation.entity"
import { describe, expect, test } from "bun:test"

describe("RentalReservation.create", () => {
  test("builds with UUID id and requested status", () => {
    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-01-10",
      endDate: "2026-01-15",
      purpose: "Presentation",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(reservation).toBeInstanceOf(RentalReservation)

    if ("reason" in reservation) {
      throw new Error("expected success")
    }

    expect(reservation.id.length).toBeGreaterThan(0)
    expect(reservation.status).toBe("requested")
  })

  test("returns invalid_date_range when startDate > endDate", () => {
    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-01-15",
      endDate: "2026-01-10",
      purpose: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(reservation).toEqual({ reason: "invalid_date_range" })
  })
})

describe("RentalReservation.withPurpose", () => {
  test("returns new with changed purpose", () => {
    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-01-10",
      endDate: "2026-01-15",
      purpose: "original",
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if ("reason" in reservation) {
      throw new Error("expected success")
    }

    const updated = reservation.withPurpose("updated purpose")

    expect(updated.purpose).toBe("updated purpose")
  })
})

describe("RentalReservation.withDetails", () => {
  test("returns new with valid dates", () => {
    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-01-10",
      endDate: "2026-01-15",
      purpose: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if ("reason" in reservation) {
      throw new Error("expected success")
    }

    const updated = reservation.withDetails({
      itemName: "Camera",
      startDate: "2026-02-01",
      endDate: "2026-02-05",
    })

    if ("reason" in updated) {
      throw new Error("expected success")
    }

    expect(updated.itemName).toBe("Camera")
    expect(updated.startDate).toBe("2026-02-01")
  })

  test("returns invalid_date_range with invalid dates", () => {
    const reservation = RentalReservation.create({
      requesterId: 1,
      itemName: "Projector",
      startDate: "2026-01-10",
      endDate: "2026-01-15",
      purpose: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    if ("reason" in reservation) {
      throw new Error("expected success")
    }

    const updated = reservation.withDetails({
      itemName: "Camera",
      startDate: "2026-02-05",
      endDate: "2026-02-01",
    })

    expect(updated).toEqual({ reason: "invalid_date_range" })
  })
})
