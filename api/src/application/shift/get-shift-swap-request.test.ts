import { describe, expect, test } from "bun:test"
import { GetShiftSwapRequest } from "@/application/shift/get-shift-swap-request"
import { ShiftSwapRequest } from "@/domain/shift/shift-swap-request"
import { ShiftSwapRequestRepository } from "@/infrastructure/shift/shift-swap-request-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"

async function createSwapRequest(
  repository: ShiftSwapRequestRepository,
): Promise<ShiftSwapRequest> {
  const result = await repository.create(
    ShiftSwapRequest.create({
      requesterEmployeeId: 1,
      targetEmployeeId: 2,
      date: "2026-06-01",
      note: null,
    }),
  )

  if (result instanceof Error || "reason" in result) {
    throw new Error("failed to create swap request")
  }

  return result
}

describe("GetShiftSwapRequest", () => {
  test("requester can view their own swap request", async () => {
    const { context } = createTestContext()

    const repository = new ShiftSwapRequestRepository(context)

    const swapRequest = await createSwapRequest(repository)

    if (swapRequest.id === null) throw new Error("id should not be null")

    const result = await new GetShiftSwapRequest(context).run({
      viewerEmployeeId: 1,
      viewerRole: "member",
      swapRequestId: swapRequest.id,
    })

    expect(result).toBeInstanceOf(ShiftSwapRequest)
  })

  test("targetEmployee can view a swap request they are the target of", async () => {
    const { context } = createTestContext()

    const repository = new ShiftSwapRequestRepository(context)

    const swapRequest = await createSwapRequest(repository)

    if (swapRequest.id === null) throw new Error("id should not be null")

    const result = await new GetShiftSwapRequest(context).run({
      viewerEmployeeId: 2,
      viewerRole: "member",
      swapRequestId: swapRequest.id,
    })

    expect(result).toBeInstanceOf(ShiftSwapRequest)
  })

  test("manager (approver) can view any swap request", async () => {
    const { context } = createTestContext()

    const repository = new ShiftSwapRequestRepository(context)

    const swapRequest = await createSwapRequest(repository)

    if (swapRequest.id === null) throw new Error("id should not be null")

    const result = await new GetShiftSwapRequest(context).run({
      viewerEmployeeId: 99,
      viewerRole: "manager",
      swapRequestId: swapRequest.id,
    })

    expect(result).toBeInstanceOf(ShiftSwapRequest)
  })

  test("unrelated member cannot view a swap request", async () => {
    const { context } = createTestContext()

    const repository = new ShiftSwapRequestRepository(context)

    const swapRequest = await createSwapRequest(repository)

    if (swapRequest.id === null) throw new Error("id should not be null")

    const result = await new GetShiftSwapRequest(context).run({
      viewerEmployeeId: 99,
      viewerRole: "member",
      swapRequestId: swapRequest.id,
    })

    expect(result).toEqual({ reason: "not_visible" })
  })

  test("returns swap_request_not_found for a non-existent id", async () => {
    const { context } = createTestContext()

    const result = await new GetShiftSwapRequest(context).run({
      viewerEmployeeId: 1,
      viewerRole: "member",
      swapRequestId: 999999,
    })

    expect(result).toEqual({ reason: "swap_request_not_found" })
  })
})
