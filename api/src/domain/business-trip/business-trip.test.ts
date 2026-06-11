import { BusinessTrip } from "@/domain/business-trip/business-trip"
import { describe, expect, test } from "bun:test"

describe("BusinessTrip.create", () => {
  test("builds instance with status requested for valid dates", () => {
    const trip = BusinessTrip.create({
      travelerId: 1,
      destination: "大阪",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      purpose: "顧客訪問",
      estimatedCost: 50000,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(trip).toBeInstanceOf(BusinessTrip)

    if (!(trip instanceof BusinessTrip)) {
      throw new Error("expected BusinessTrip")
    }

    expect(trip.status).toBe("requested")
    expect(trip.travelerId).toBe(1)
    expect(trip.destination).toBe("大阪")
    expect(trip.startDate).toBe("2026-07-01")
    expect(trip.endDate).toBe("2026-07-03")
    expect(trip.purpose).toBe("顧客訪問")
    expect(trip.estimatedCost).toBe(50000)
    expect(trip.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  test("returns error when startDate is after endDate", () => {
    const trip = BusinessTrip.create({
      travelerId: 1,
      destination: "大阪",
      startDate: "2026-07-05",
      endDate: "2026-07-03",
      purpose: "顧客訪問",
      estimatedCost: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(trip).toEqual({ reason: "invalid_date_range" })
  })
})

describe("BusinessTrip.isModifiable", () => {
  test("returns true for requested status", () => {
    const trip = BusinessTrip.create({
      travelerId: 1,
      destination: "東京",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      purpose: "会議",
      estimatedCost: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    if (!(trip instanceof BusinessTrip)) {
      throw new Error("expected BusinessTrip")
    }

    expect(trip.isModifiable).toBe(true)
  })

  test("returns false for approved status", () => {
    const trip = new BusinessTrip({
      id: crypto.randomUUID(),
      travelerId: 1,
      destination: "東京",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      purpose: "会議",
      estimatedCost: null,
      status: "approved",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(trip.isModifiable).toBe(false)
  })
})

describe("BusinessTrip.withDetails", () => {
  test("returns new instance with valid dates", () => {
    const trip = BusinessTrip.create({
      travelerId: 1,
      destination: "大阪",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      purpose: "顧客訪問",
      estimatedCost: 50000,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    if (!(trip instanceof BusinessTrip)) {
      throw new Error("expected BusinessTrip")
    }

    const updated = trip.withDetails({
      destination: "名古屋",
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      purpose: "研修",
      estimatedCost: 80000,
    })

    expect(updated).toBeInstanceOf(BusinessTrip)

    if (!(updated instanceof BusinessTrip)) {
      throw new Error("expected BusinessTrip")
    }

    expect(updated.destination).toBe("名古屋")
    expect(updated.startDate).toBe("2026-08-01")
    expect(updated.endDate).toBe("2026-08-05")
    expect(updated.purpose).toBe("研修")
    expect(updated.estimatedCost).toBe(80000)
    expect(updated.travelerId).toBe(1)
  })

  test("returns error with invalid dates", () => {
    const trip = BusinessTrip.create({
      travelerId: 1,
      destination: "大阪",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      purpose: "顧客訪問",
      estimatedCost: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    if (!(trip instanceof BusinessTrip)) {
      throw new Error("expected BusinessTrip")
    }

    const updated = trip.withDetails({
      destination: "名古屋",
      startDate: "2026-08-10",
      endDate: "2026-08-05",
      purpose: "研修",
      estimatedCost: null,
    })

    expect(updated).toEqual({ reason: "invalid_date_range" })
  })
})
