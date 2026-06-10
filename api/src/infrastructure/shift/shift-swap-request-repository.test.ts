import { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

function createSwapRequest(props: Parameters<typeof ShiftSwapRequest.create>[0]): ShiftSwapRequest {
  const result = ShiftSwapRequest.create(props)
  if ("reason" in result) throw new Error("unexpected self_reference in test")
  return result
}

describe("ShiftSwapRequestRepository", () => {
  test("create then findById round-trips the swap request", async () => {
    const { context } = createTestContext()

    const repository = new ShiftSwapRequestRepository(context)

    const created = await repository.create(
      createSwapRequest({
        requesterEmployeeId: 1,
        targetEmployeeId: 2,
        date: "2026-05-31",
        note: null,
      }),
    )

    expect(created).toBeInstanceOf(ShiftSwapRequest)

    if (created instanceof Error) {
      throw new Error("create failed")
    }

    if ("reason" in created) {
      throw new Error("unexpected already_exists")
    }

    if (created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(ShiftSwapRequest)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.status).toBe("pending")
    expect(found.targetEmployeeId).toBe(2)
  })
})
