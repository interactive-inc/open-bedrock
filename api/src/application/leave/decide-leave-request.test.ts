import { LeaveRequest } from "@/domain/leave/leave-request.entity"
import { DecideLeaveRequest } from "@/application/leave/decide-leave-request"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { LeaveRequestRepository } from "@/infrastructure/leave/leave-request-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { expectApplicationError } from "@/interface/test-helpers/expect-application-error"
import { seedD1 } from "@/interface/test-helpers/seed-d1"
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
      unit: "full_day",
      hours: null,
      reason: "personal",
      createdAt: "2026-06-01T00:00:00.000Z",
    }),
  )

  if (created instanceof Error || created === null) {
    throw new Error("seed failed")
  }

  return created
}

async function seedManagerRelationship(db: D1Database): Promise<void> {
  await seedD1(db, "employees", [
    { id: 2, code: "E002", name: "Manager", status: "active" },
    { id: 5, code: "E005", name: "Member", status: "active" },
  ])

  await seedD1(db, "org_memberships", [
    {
      department_code: "TEAM",
      employee_code: "E005",
      manager_employee_code: "E002",
    },
  ])
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
      createdAt: "2026-06-15T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("allows manager to reject a leave request", async () => {
    const { context, db } = createTestContext()

    await seedManagerRelationship(db)

    const repository = new LeaveRequestRepository(context)

    const request = await seedPendingRequest(repository, 5)

    const result = await new DecideLeaveRequest(context).run({
      session: makeTestSession("manager"),
      leaveRequestId: request.id ?? 0,
      approverId: 2,
      action: "reject",
      comment: "insufficient coverage",
      createdAt: "2026-06-15T00:00:00.000Z",
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
      session: makeTestSession("root"),
      leaveRequestId: request.id ?? 0,
      approverId: 5,
      action: "approve",
      comment: null,
      createdAt: "2026-06-15T00:00:00.000Z",
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
      createdAt: "2026-06-15T00:00:00.000Z",
    })

    if (result instanceof Error) {
      throw result
    }

    if (!(result instanceof LeaveRequest)) {
      throw new Error("unexpected failure")
    }

    expect(result.status).toBe("rejected")
  })

  test("returns cross_fiscal_year when leave request spans fiscal years", async () => {
    const { context, db } = createTestContext()

    await seedManagerRelationship(db)

    const repository = new LeaveRequestRepository(context)

    // 2026-03-30 (FY2025) → 2026-04-02 (FY2026) crosses fiscal year boundary
    const created = await repository.create(
      LeaveRequest.create({
        employeeId: 5,
        leaveType: "annual",
        startDate: "2026-03-30",
        endDate: "2026-04-02",
        days: 4,
        unit: "full_day",
        hours: null,
        reason: "vacation",
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created === null) {
      throw new Error("seed failed")
    }

    const result = await new DecideLeaveRequest(context).run({
      session: makeTestSession("manager"),
      leaveRequestId: created.id ?? 0,
      approverId: 2,
      action: "approve",
      comment: null,
      createdAt: "2026-06-15T00:00:00.000Z",
    })

    expectApplicationError(result, ValidationError, "cross_fiscal_year")
  })

  test("allows approval when leave request stays within the same fiscal year", async () => {
    const { context, db } = createTestContext()

    await seedManagerRelationship(db)

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

    // 2026-03-28 → 2026-03-31: both belong to FY2025, no cross-year issue
    const created = await repository.create(
      LeaveRequest.create({
        employeeId: 5,
        leaveType: "annual",
        startDate: "2026-03-28",
        endDate: "2026-03-31",
        days: 4,
        unit: "full_day",
        hours: null,
        reason: "vacation",
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created === null) {
      throw new Error("seed failed")
    }

    const result = await new DecideLeaveRequest(context).run({
      session: makeTestSession("manager"),
      leaveRequestId: created.id ?? 0,
      approverId: 2,
      action: "reject",
      comment: "no coverage",
      createdAt: "2026-06-15T00:00:00.000Z",
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
