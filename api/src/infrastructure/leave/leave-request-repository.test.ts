import { LeaveRequest } from "@/domain/leave/leave-request"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("LeaveRequestRepository", () => {
  test("create then findById round-trips the leave request", async () => {
    const { context } = createTestContext()

    const repository = new LeaveRequestRepository(context)

    const created = await repository.create(
      LeaveRequest.create({
        employeeId: 1,
        leaveType: "annual",
        startDate: "2026-02-01",
        endDate: "2026-02-03",
        days: 3,
        reason: "テスト休暇",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(LeaveRequest)

    if (created instanceof Error || created.id === null) {
      throw new Error("create failed")
    }

    const found = await repository.findById(created.id)

    expect(found).toBeInstanceOf(LeaveRequest)

    if (found instanceof Error || found === null) {
      throw new Error("findById failed")
    }

    expect(found.days).toBe(3)
    expect(found.status).toBe("pending")
  })

  test("update persists the decision", async () => {
    const { context } = createTestContext()

    const repository = new LeaveRequestRepository(context)

    const created = await repository.create(
      LeaveRequest.create({
        employeeId: 1,
        leaveType: "annual",
        startDate: "2026-02-01",
        endDate: "2026-02-03",
        days: 3,
        reason: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error) {
      throw created
    }

    const updated = await repository.update(
      created.decide({ status: "approved", approverId: 2, decidedComment: "承認" }),
    )

    expect(updated).toBeInstanceOf(LeaveRequest)

    if (updated instanceof Error || updated === null) {
      throw new Error("update failed")
    }

    expect(updated.status).toBe("approved")
    expect(updated.approverId).toBe(2)
  })
})
