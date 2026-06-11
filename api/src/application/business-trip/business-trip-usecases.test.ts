import { describe, expect, test } from "bun:test"
import { CancelBusinessTrip } from "@/application/business-trip/cancel-business-trip"
import { CreateBusinessTrip } from "@/application/business-trip/create-business-trip"
import { GetBusinessTrip } from "@/application/business-trip/get-business-trip"
import { ListMyBusinessTrips } from "@/application/business-trip/list-my-business-trips"
import { UpdateBusinessTrip } from "@/application/business-trip/update-business-trip"
import { BusinessTrip } from "@/domain/business-trip/business-trip"
import type { Context } from "@/env"
import { createTestContext } from "@/interface/shared/test/create-test-context"

async function seedTrip(context: Context, travelerId: number): Promise<string> {
  const created = await new CreateBusinessTrip(context).run({
    travelerId: travelerId,
    destination: "Osaka Branch",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    purpose: "Partner meeting",
    estimatedCost: 45000,
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof Error || "reason" in created) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateBusinessTrip", () => {
  test("creates a business trip with status requested", async () => {
    const { context } = createTestContext()

    const created = await new CreateBusinessTrip(context).run({
      travelerId: 2,
      destination: "Sapporo Site",
      startDate: "2026-06-20",
      endDate: "2026-06-22",
      purpose: "Inspection",
      estimatedCost: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(BusinessTrip)

    if (created instanceof Error || "reason" in created) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("requested")
    expect(created.estimatedCost).toBe(null)
  })
})

describe("GetBusinessTrip", () => {
  test("returns the trip for its traveler", async () => {
    const { context } = createTestContext()

    const tripId = await seedTrip(context, 5)

    const result = await new GetBusinessTrip(context).run({
      businessTripId: tripId,
      travelerId: 5,
    })

    expect(result).toBeInstanceOf(BusinessTrip)
  })

  test("rejects a non traveler with not_traveler", async () => {
    const { context } = createTestContext()

    const tripId = await seedTrip(context, 5)

    const result = await new GetBusinessTrip(context).run({
      businessTripId: tripId,
      travelerId: 6,
    })

    expect(result).toEqual({ reason: "not_traveler" })
  })

  test("returns business_trip_not_found for an unknown id", async () => {
    const { context } = createTestContext()

    const result = await new GetBusinessTrip(context).run({
      businessTripId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      travelerId: 5,
    })

    expect(result).toEqual({ reason: "business_trip_not_found" })
  })
})

describe("ListMyBusinessTrips", () => {
  test("returns only the traveler's trips", async () => {
    const { context } = createTestContext()

    await seedTrip(context, 5)

    await seedTrip(context, 6)

    const result = await new ListMyBusinessTrips(context).run({ travelerId: 5, limit: 50, offset: 0 })

    if (result instanceof Error) {
      throw new Error("list failed")
    }

    expect(result.length).toBe(1)
    expect(result[0].travelerId).toBe(5)
  })
})

describe("UpdateBusinessTrip", () => {
  test("updates the details for the traveler", async () => {
    const { context } = createTestContext()

    const tripId = await seedTrip(context, 5)

    const result = await new UpdateBusinessTrip(context).run({
      businessTripId: tripId,
      travelerId: 5,
      destination: "Fukuoka Office",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      purpose: "Onboarding",
      estimatedCost: 38000,
    })

    expect(result).toBeInstanceOf(BusinessTrip)

    if (result instanceof Error || "reason" in result) {
      throw new Error("update failed")
    }

    expect(result.destination).toBe("Fukuoka Office")
    expect(result.estimatedCost).toBe(38000)
  })

  test("rejects a non traveler with not_traveler", async () => {
    const { context } = createTestContext()

    const tripId = await seedTrip(context, 5)

    const result = await new UpdateBusinessTrip(context).run({
      businessTripId: tripId,
      travelerId: 6,
      destination: "Fukuoka Office",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      purpose: "Onboarding",
      estimatedCost: null,
    })

    expect(result).toEqual({ reason: "not_traveler" })
  })
})

describe("CancelBusinessTrip", () => {
  test("cancels the trip for the traveler", async () => {
    const { context } = createTestContext()

    const tripId = await seedTrip(context, 5)

    const result = await new CancelBusinessTrip(context).run({
      businessTripId: tripId,
      travelerId: 5,
    })

    expect(result).toEqual({ reason: "cancelled" })
  })

  test("rejects a non traveler with not_traveler", async () => {
    const { context } = createTestContext()

    const tripId = await seedTrip(context, 5)

    const result = await new CancelBusinessTrip(context).run({
      businessTripId: tripId,
      travelerId: 6,
    })

    expect(result).toEqual({ reason: "not_traveler" })
  })
})
