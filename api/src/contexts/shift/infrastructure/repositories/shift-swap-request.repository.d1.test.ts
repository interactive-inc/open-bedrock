import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { ShiftSwapRequest } from "@/contexts/shift/domain/entities/shift-swap-request.entity"
import { ShiftSwapRequestRepository } from "@/contexts/shift/infrastructure/repositories/shift-swap-request.repository"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "create-then-findbyid-round-trips-the-swap",
      "create-returns-null-when-a-pending-request",
      "create-allows-a-new-request-after-the-previous",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

function createSwapRequest(props: Parameters<typeof ShiftSwapRequest.create>[0]): ShiftSwapRequest {
  const result = ShiftSwapRequest.create(props)
  if ("reason" in result) throw new Error("unexpected self_reference in test")
  return result
}

describe("ShiftSwapRequestRepository", () => {
  test("create then findById round-trips the swap request", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-then-findbyid-round-trips-the-swap",
    )

    const repository = new ShiftSwapRequestRepository(context)

    const created = await repository.create(
      createSwapRequest({
        requesterEmployeeId: toWorkforceEmployeeId(1),
        targetEmployeeId: toWorkforceEmployeeId(2),
        date: "2026-05-31",
        note: null,
      }),
    )

    expect(created).toBeInstanceOf(ShiftSwapRequest)

    if (created instanceof Error || created === null) {
      throw new Error("create failed")
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
    expect(found.targetEmployeeId).toBe(toWorkforceEmployeeId(2))
  })

  test("create returns null when a pending request already exists for the same pair and date", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-returns-null-when-a-pending-request",
    )

    const repository = new ShiftSwapRequestRepository(context)

    const first = await repository.create(
      createSwapRequest({
        requesterEmployeeId: toWorkforceEmployeeId(1),
        targetEmployeeId: toWorkforceEmployeeId(2),
        date: "2026-06-01",
        note: null,
      }),
    )

    expect(first).toBeInstanceOf(ShiftSwapRequest)

    const duplicate = await repository.create(
      createSwapRequest({
        requesterEmployeeId: toWorkforceEmployeeId(1),
        targetEmployeeId: toWorkforceEmployeeId(2),
        date: "2026-06-01",
        note: "second attempt",
      }),
    )

    expect(duplicate).toBeNull()
  })

  test("create allows a new request after the previous one is no longer pending", async () => {
    const { context } = await createLocalD1Context(
      local,
      "create-allows-a-new-request-after-the-previous",
    )

    const repository = new ShiftSwapRequestRepository(context)

    const first = await repository.create(
      createSwapRequest({
        requesterEmployeeId: toWorkforceEmployeeId(1),
        targetEmployeeId: toWorkforceEmployeeId(2),
        date: "2026-06-02",
        note: null,
      }),
    )

    if (first instanceof Error || first === null) {
      throw new Error("first create failed")
    }

    // Approve the first request so it is no longer pending
    const approved = first.withApproved("2026-06-02T10:00:00.000Z")
    const updated = await repository.update(approved)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.status).toBe("approved")

    // Now a new pending request for the same pair/date should succeed
    const second = await repository.create(
      createSwapRequest({
        requesterEmployeeId: toWorkforceEmployeeId(1),
        targetEmployeeId: toWorkforceEmployeeId(2),
        date: "2026-06-02",
        note: "re-request after approval",
      }),
    )

    expect(second).toBeInstanceOf(ShiftSwapRequest)

    if (second instanceof Error || second === null) {
      throw new Error("second create failed")
    }

    expect(second.status).toBe("pending")
  })
})
