import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { describe, expect, test } from "bun:test"

describe("LeaveRequestRepository", () => {
  test("create then findById round-trips the leave request", async () => {
    const { context } = await createTestContext()

    const repository = new LeaveRequestRepository(context)

    const created = await repository.create(
      LeaveRequest.create({
        employeeId: toWorkforceEmployeeId(1),
        leaveType: "annual",
        startDate: "2026-02-01",
        endDate: "2026-02-03",
        days: 3,
        unit: "full_day",
        hours: null,
        consumedDays: 3,
        reason: "テスト休暇",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(LeaveRequest)

    if (created instanceof Error || created === null || created.id === null) {
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

  test("decideFromPending decides a pending request once, then returns null for a re-decision", async () => {
    const { context } = await createTestContext()

    const repository = new LeaveRequestRepository(context)

    const created = await repository.create(
      LeaveRequest.create({
        employeeId: toWorkforceEmployeeId(1),
        leaveType: "annual",
        startDate: "2026-02-01",
        endDate: "2026-02-03",
        days: 3,
        unit: "full_day",
        hours: null,
        consumedDays: 3,
        reason: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    if (created instanceof Error || created === null || created.id === null) {
      throw new Error("create failed")
    }

    const first = await repository.decideFromPending({
      leaveRequestId: created.id,
      status: "approved",
      approverId: toWorkforceEmployeeId(2),
      decidedComment: "承認",
    })

    expect(first).toBeInstanceOf(LeaveRequest)

    if (first instanceof Error || first === null) {
      throw new Error("first decideFromPending failed")
    }

    expect(first.status).toBe("approved")

    // 決定済みは pending 条件に当たらず 0 行更新 → null（再決定を弾く）。
    const second = await repository.decideFromPending({
      leaveRequestId: created.id,
      status: "rejected",
      approverId: toWorkforceEmployeeId(3),
      decidedComment: "却下",
    })

    expect(second).toBeNull()
  })

  describe("findOverlapping", () => {
    /** pending 申請を 1 件作成し、その repository（同一 DB）と採番 id を返す。 */
    async function createPending(props: {
      employeeId: EmployeeId
      startDate: string
      endDate: string
    }): Promise<{ repository: LeaveRequestRepository; id: number }> {
      const { context } = await createTestContext()

      const repository = new LeaveRequestRepository(context)

      const created = await repository.create(
        LeaveRequest.create({
          employeeId: props.employeeId,
          leaveType: "annual",
          startDate: props.startDate,
          endDate: props.endDate,
          days: 1,
          unit: "full_day",
          hours: null,
          consumedDays: 1,
          reason: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      )

      if (created instanceof Error || created === null || created.id === null) {
        throw new Error("create failed")
      }

      return { repository, id: created.id }
    }

    test("matches an overlapping pending request for the same employee", async () => {
      const created = await createPending({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-03",
        endDate: "2026-02-07",
      })

      if (result instanceof Error) {
        throw result
      }

      expect(result.length).toBe(1)
    })

    test("excludes the request identified by excludeId", async () => {
      const created = await createPending({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-02",
        endDate: "2026-02-04",
        excludeId: created.id,
      })

      if (result instanceof Error) {
        throw result
      }

      expect(result.length).toBe(0)
    })

    test("ignores rejected requests", async () => {
      const created = await createPending({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      })

      await created.repository.decideFromPending({
        leaveRequestId: created.id,
        status: "rejected",
        approverId: toWorkforceEmployeeId(2),
        decidedComment: "却下",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-02",
        endDate: "2026-02-04",
      })

      if (result instanceof Error) {
        throw result
      }

      expect(result.length).toBe(0)
    })

    test("ignores other employees' requests", async () => {
      const created = await createPending({
        employeeId: toWorkforceEmployeeId(10),
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-02",
        endDate: "2026-02-04",
      })

      if (result instanceof Error) {
        throw result
      }

      expect(result.length).toBe(0)
    })

    test("treats a shared boundary date as an overlap", async () => {
      const created = await createPending({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-01",
        endDate: "2026-02-03",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-03",
        endDate: "2026-02-05",
      })

      if (result instanceof Error) {
        throw result
      }

      expect(result.length).toBe(1)
    })

    test("does not match an adjacent (non-overlapping) period", async () => {
      const created = await createPending({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-01",
        endDate: "2026-02-03",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(1),
        startDate: "2026-02-04",
        endDate: "2026-02-06",
      })

      if (result instanceof Error) {
        throw result
      }

      expect(result.length).toBe(0)
    })
  })
})
