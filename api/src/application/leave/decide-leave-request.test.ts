import { LeaveRequest } from "@/domain/leave/leave-request.entity"
import { DecideLeaveRequest } from "@/application/leave/decide-leave-request"
import { ForbiddenError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { expectApplicationError } from "@/interface/shared/test/expect-application-error"
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
      session: makeTestSession("member"),
      leaveRequestId: request.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("allows manager to reject a leave request", async () => {
    const { context } = createTestContext()

    const repository = new LeaveRequestRepository(context)

    const request = await seedPendingRequest(repository, 5)

    const result = await new DecideLeaveRequest(context).run({
      session: makeTestSession("manager"),
      leaveRequestId: request.id ?? 0,
      approverId: 2,
      action: "reject",
      comment: "insufficient coverage",
    })

    if (result instanceof Error) {
      throw result
    }

    if (!(result instanceof LeaveRequest)) {
      throw new Error("unexpected failure")
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
      session: makeTestSession("admin"),
      leaveRequestId: request.id ?? 0,
      approverId: 5,
      action: "approve",
      comment: null,
    })

    expectApplicationError(result, ForbiddenError, "self_approval")
  })

  test("allows hr role to decide", async () => {
    const { context } = createTestContext()

    const repository = new LeaveRequestRepository(context)

    const request = await seedPendingRequest(repository, 5)

    const result = await new DecideLeaveRequest(context).run({
      session: makeTestSession("hr"),
      leaveRequestId: request.id ?? 0,
      approverId: 2,
      action: "reject",
      comment: "policy violation",
    })

    if (result instanceof Error) {
      throw result
    }

    if (!(result instanceof LeaveRequest)) {
      throw new Error("unexpected failure")
    }

    expect(result.status).toBe("rejected")
  })
})
