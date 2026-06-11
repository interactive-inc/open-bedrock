import { LeaveRequest } from "@/domain/leave/leave-request"
import { DecideLeaveRequest } from "@/application/leave/decide-leave-request"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { seedD1 } from "@/interface/shared/test/seed-d1"
import { describe, expect, test } from "bun:test"

async function seedPendingRequest(
  repository: LeaveRequestRepository,
  employeeId: number,
): Promise<LeaveRequest> {
  const created = await repository.create(
    LeaveRequest.create({
      employeeId,
      leaveType: "annual",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      days: 3,
      reason: "personal",
      createdAt: "2026-06-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || created === null) {
    throw new Error("seed failed")
  }

  return created
}

describe("DecideLeaveRequest", () => {
  test("returns forbidden for a member role", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "leave_balances", [
      {
        employee_id: 5,
        fiscal_year: "2026",
        leave_type: "annual",
        granted_days: 20,
        used_days: 0,
        remaining_days: 20,
      },
    ])

    const repository = new LeaveRequestRepository(context)

    const request = await seedPendingRequest(repository, 5)

    const result = await new DecideLeaveRequest(context).run({
      viewerRole: "member",
      leaveRequestId: request.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
    })

    if (result instanceof Error) {
      throw result
    }

    if (!("failure" in result)) {
      throw new Error("expected a failure result")
    }

    expect(result.failure).toBe("forbidden")
  })

  test("allows manager to reject a leave request", async () => {
    const { context } = createTestContext()

    const repository = new LeaveRequestRepository(context)

    const request = await seedPendingRequest(repository, 5)

    const result = await new DecideLeaveRequest(context).run({
      viewerRole: "manager",
      leaveRequestId: request.id ?? 0,
      approverId: 2,
      action: "reject",
      comment: "insufficient coverage",
    })

    if (result instanceof Error) {
      throw result
    }

    if ("failure" in result) {
      throw new Error(`unexpected failure: ${result.failure}`)
    }

    expect(result.status).toBe("rejected")
  })

  test("returns self_approval when approver is the requester", async () => {
    const { context, db } = createTestContext()

    await seedD1(db, "leave_balances", [
      {
        employee_id: 5,
        fiscal_year: "2026",
        leave_type: "annual",
        granted_days: 20,
        used_days: 0,
        remaining_days: 20,
      },
    ])

    const repository = new LeaveRequestRepository(context)

    const request = await seedPendingRequest(repository, 5)

    const result = await new DecideLeaveRequest(context).run({
      viewerRole: "admin",
      leaveRequestId: request.id ?? 0,
      approverId: 5,
      action: "approve",
      comment: null,
    })

    if (result instanceof Error) {
      throw result
    }

    if (!("failure" in result)) {
      throw new Error("expected a failure result")
    }

    expect(result.failure).toBe("self_approval")
  })

  test("allows hr role to decide", async () => {
    const { context } = createTestContext()

    const repository = new LeaveRequestRepository(context)

    const request = await seedPendingRequest(repository, 5)

    const result = await new DecideLeaveRequest(context).run({
      viewerRole: "hr",
      leaveRequestId: request.id ?? 0,
      approverId: 2,
      action: "reject",
      comment: "policy violation",
    })

    if (result instanceof Error) {
      throw result
    }

    if ("failure" in result) {
      throw new Error(`unexpected failure: ${result.failure}`)
    }

    expect(result.status).toBe("rejected")
  })
})
