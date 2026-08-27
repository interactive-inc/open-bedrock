import { describe, expect, test } from "bun:test"
import { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"
import { ClockIn } from "@/contexts/attendance/application/clock-in"
import { AttendanceRecordRepository } from "@/contexts/attendance/infrastructure/repositories/attendance-record.repository"
import { ApplicationError, ConflictError } from "@/lib/errors"
import { createTestContext } from "@/api/test/support/create-test-context"
import { expectApplicationError } from "@/api/test/support/expect-application-error"

describe("ClockIn", () => {
  test("creates an open attendance record", async () => {
    const { context } = createTestContext()

    const result = await new ClockIn(context).run({
      employeeId: 1,
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    expect(result).toBeInstanceOf(AttendanceRecord)

    if (result instanceof ApplicationError) {
      throw new Error("expected attendance record")
    }

    expect(result.employeeId).toBe(1)
    expect(result.clockInAt).toBe("2026-03-15T09:00:00.000Z")
    expect(result.status).toBe("open")
    expect(result.workDate).toBe("2026-03-15")
  })

  test("creates an attendance record with a note", async () => {
    const { context } = createTestContext()

    const result = await new ClockIn(context).run({
      employeeId: 1,
      now: "2026-03-15T09:00:00.000Z",
      note: "remote work",
    })

    if (result instanceof ApplicationError) {
      throw new Error("expected attendance record")
    }

    expect(result.note).toBe("remote work")
  })

  test("rejects duplicate clock in with already_clocked_in", async () => {
    const { context } = createTestContext()

    const first = await new ClockIn(context).run({
      employeeId: 1,
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    if (first instanceof ApplicationError) {
      throw new Error("setup failed")
    }

    const second = await new ClockIn(context).run({
      employeeId: 1,
      now: "2026-03-15T10:00:00.000Z",
      note: null,
    })

    expectApplicationError(second, ConflictError, "already_clocked_in")
  })

  test("allows clock in for a different employee", async () => {
    const { context } = createTestContext()

    await new ClockIn(context).run({
      employeeId: 1,
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    const result = await new ClockIn(context).run({
      employeeId: 2,
      now: "2026-03-15T09:05:00.000Z",
      note: null,
    })

    expect(result).toBeInstanceOf(AttendanceRecord)
  })

  test("allows clock in after previous record is closed", async () => {
    const { context } = createTestContext()

    const first = await new ClockIn(context).run({
      employeeId: 1,
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    if (first instanceof ApplicationError) {
      throw new Error("setup failed")
    }

    const repository = new AttendanceRecordRepository(context)

    await repository.update(
      first.withClosed({
        clockOutAt: "2026-03-15T18:00:00.000Z",
        workMinutes: 540,
      }),
    )

    const second = await new ClockIn(context).run({
      employeeId: 1,
      now: "2026-03-16T09:00:00.000Z",
      note: null,
    })

    expect(second).toBeInstanceOf(AttendanceRecord)
  })
})
