import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { BusinessTrip } from "@/contexts/business-trip/domain/entities/business-trip.entity"
import { BusinessTripRepository } from "@/contexts/business-trip/infrastructure/repositories/business-trip.repository"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["overlap-update"] })
})

afterAll(async () => {
  await local.dispose()
})

function trip(travelerId: number, startDate: string, endDate: string): BusinessTrip {
  const created = BusinessTrip.create({
    travelerId: toWorkforceEmployeeId(testEmployeeId(travelerId)),
    destination: "Osaka Branch",
    startDate,
    endDate,
    purpose: "Partner meeting",
    estimatedCost: 45000,
    createdAt: "2026-01-01T00:00:00.000Z",
  })

  if ("reason" in created) throw new Error("invalid trip")

  return created
}

describe("BusinessTripRepository on local D1", () => {
  test("refuses overlapping inserts, excludes the trip itself and persists updates", async () => {
    const { context } = await createLocalD1Context(local, "overlap-update")

    const repository = new BusinessTripRepository(context)

    const first = await repository.create(trip(5, "2026-06-10", "2026-06-12"))

    if (first === null || first instanceof Error) throw new Error("create failed")

    expect(await repository.create(trip(5, "2026-06-11", "2026-06-13"))).toBe(null)
    expect(await repository.create(trip(6, "2026-06-11", "2026-06-13"))).toBeInstanceOf(
      BusinessTrip,
    )

    const overlapping = await repository.findOverlapping({
      travelerId: toWorkforceEmployeeId(testEmployeeId(5)),
      startDate: "2026-06-12",
      endDate: "2026-06-14",
      excludeBusinessTripId: null,
    })

    expect(overlapping instanceof Error ? overlapping : overlapping.map((row) => row.id)).toEqual([
      first.id,
    ])

    const excludingSelf = await repository.findOverlapping({
      travelerId: toWorkforceEmployeeId(testEmployeeId(5)),
      startDate: "2026-06-12",
      endDate: "2026-06-14",
      excludeBusinessTripId: first.id,
    })

    expect(excludingSelf).toEqual([])

    const changed = first.withDetails({
      destination: "Fukuoka Office",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      purpose: "Onboarding",
      estimatedCost: 38000,
    })

    if ("reason" in changed) throw new Error("invalid change")

    await repository.update(changed)

    const found = await repository.findById(first.id)

    if (found === null || found instanceof Error) throw new Error("trip not persisted")

    expect(found.destination).toBe("Fukuoka Office")
    expect(found.estimatedCost).toBe(38000)
    expect(found.status).toBe("requested")
  })
})
