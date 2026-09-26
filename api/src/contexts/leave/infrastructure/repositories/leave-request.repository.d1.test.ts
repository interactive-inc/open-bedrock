import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: [
      "round-trip",
      "overlap-same-employee",
      "overlap-exclude-id",
      "overlap-ignores-rejected",
      "overlap-other-employee",
      "overlap-shared-boundary",
      "overlap-adjacent-period",
    ],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("LeaveRequestRepository", () => {
  test("create then findById round-trips the leave request", async () => {
    const { context } = await createLocalD1Context(local, "round-trip")

    const repository = new LeaveRequestRepository(context)

    const created = await repository.create(
      LeaveRequest.create({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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

  describe("findOverlapping", () => {
    /** pending 申請を 1 件作成し、その repository（同一 DB）と採番 id を返す。 */
    async function createPending(props: {
      database: string
      employeeId: EmployeeId
      startDate: string
      endDate: string
    }): Promise<{ repository: LeaveRequestRepository; id: string; db: D1Database }> {
      const { context, db } = await createLocalD1Context(local, props.database)

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

      return { repository, id: created.id, db }
    }

    test("matches an overlapping pending request for the same employee", async () => {
      const created = await createPending({
        database: "overlap-same-employee",
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
        database: "overlap-exclude-id",
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
      const { context, db } = await createLocalD1Context(local, "overlap-ignores-rejected")
      const repository = new LeaveRequestRepository(context)
      await db
        .prepare(`INSERT INTO leave_requests
        (id,employee_id,leave_type,start_date,end_date,days,unit,hours,consumed_days,reason,status,created_at)
        VALUES ('01900049-0000-7000-8000-0000000000aa',?1,'annual','2026-02-01','2026-02-05',5,'full_day',NULL,5,NULL,'rejected','2026-01-01T00:00:00.000Z')`)
        .bind(toWorkforceEmployeeId(testEmployeeId(1)))
        .run()

      const result = await repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
        database: "overlap-other-employee",
        employeeId: toWorkforceEmployeeId(testEmployeeId(10)),
        startDate: "2026-02-01",
        endDate: "2026-02-05",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
        database: "overlap-shared-boundary",
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
        startDate: "2026-02-01",
        endDate: "2026-02-03",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
        database: "overlap-adjacent-period",
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
        startDate: "2026-02-01",
        endDate: "2026-02-03",
      })

      const result = await created.repository.findOverlapping({
        employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
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
