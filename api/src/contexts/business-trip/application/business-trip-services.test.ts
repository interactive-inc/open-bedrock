import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { CreateBusinessTrip } from "@/contexts/business-trip/application/create-business-trip"
import { UpdateBusinessTrip } from "@/contexts/business-trip/application/update-business-trip"
import { BusinessTrip } from "@/contexts/business-trip/domain/entities/business-trip.entity"
import { ConflictError, ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

/**
 * 出張申請Repositoryの型付きfake。期間重複の照会はSQLで検証するため、
 * fakeは指定された重複申請だけを返す。
 */
function createContext(options: { overlapping?: ReadonlyArray<BusinessTrip> } = {}) {
  const stored = new Map<string, BusinessTrip>()

  const businessTripRepository = {
    findById: async (id: string) => stored.get(id) ?? null,
    findOverlapping: async () => [...(options.overlapping ?? [])],
    create: async (businessTrip: BusinessTrip) => {
      stored.set(businessTrip.id, businessTrip)
      return businessTrip
    },
    update: async (businessTrip: BusinessTrip) => {
      stored.set(businessTrip.id, businessTrip)
      return businessTrip
    },
  }

  return { businessTripRepository, stored }
}

async function seedTrip(
  context: ReturnType<typeof createContext>,
  travelerId: number,
): Promise<string> {
  const created = await new CreateBusinessTrip(context).run({
    travelerId: toWorkforceEmployeeId(travelerId),
    destination: "Osaka Branch",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    purpose: "Partner meeting",
    estimatedCost: 45000,
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if (created instanceof Error) {
    throw new Error("seed failed")
  }

  return created.id
}

describe("CreateBusinessTrip", () => {
  test("creates a business trip with status requested", async () => {
    const context = createContext()

    const created = await new CreateBusinessTrip(context).run({
      travelerId: toWorkforceEmployeeId(2),
      destination: "Sapporo Site",
      startDate: "2026-06-20",
      endDate: "2026-06-22",
      purpose: "Inspection",
      estimatedCost: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(created).toBeInstanceOf(BusinessTrip)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    expect(created.status).toBe("requested")
    expect(created.estimatedCost).toBe(null)
    expect(context.stored.get(created.id)).toBe(created)
  })

  test("rejects a trip when the repository reports an overlapping trip", async () => {
    const existing = createContext()

    const tripId = await seedTrip(existing, 2)

    const overlappingTrip = existing.stored.get(tripId)

    if (overlappingTrip === undefined) throw new Error("seed failed")

    const context = createContext({ overlapping: [overlappingTrip] })

    const created = await new CreateBusinessTrip(context).run({
      travelerId: toWorkforceEmployeeId(2),
      destination: "Sapporo Site",
      startDate: "2026-06-11",
      endDate: "2026-06-13",
      purpose: "Inspection",
      estimatedCost: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(created, ConflictError, "overlapping_trip")
    expect(context.stored.size).toBe(0)
  })
})

describe("GetBusinessTrip", () => {})

describe("ListMyBusinessTrips", () => {})

describe("UpdateBusinessTrip", () => {
  test("updates the details for the traveler", async () => {
    const context = createContext()

    const tripId = await seedTrip(context, 5)

    const result = await new UpdateBusinessTrip(context).run({
      businessTripId: tripId,
      travelerId: toWorkforceEmployeeId(5),
      destination: "Fukuoka Office",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      purpose: "Onboarding",
      estimatedCost: 38000,
    })

    expect(result).toBeInstanceOf(BusinessTrip)

    if (result instanceof Error) {
      throw new Error("update failed")
    }

    expect(result.destination).toBe("Fukuoka Office")
    expect(result.estimatedCost).toBe(38000)
  })

  test("rejects a non traveler with not_traveler", async () => {
    const context = createContext()

    const tripId = await seedTrip(context, 5)

    const result = await new UpdateBusinessTrip(context).run({
      businessTripId: tripId,
      travelerId: toWorkforceEmployeeId(6),
      destination: "Fukuoka Office",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      purpose: "Onboarding",
      estimatedCost: null,
    })

    expectApplicationError(result, ForbiddenError, "not_traveler")
  })
})

describe("CancelBusinessTrip", () => {})
