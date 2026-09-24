import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"
import { ClockIn } from "@/contexts/attendance/application/clock-in"
import { createFakeAttendanceRecordRepository } from "@/contexts/attendance/test/fake-attendance-record-repository.test-support"
import { AttendanceRecordSourceFrozenError } from "@/contexts/attendance/infrastructure/repositories/errors"
import { UniqueConstraintError } from "@/lib/d1/errors"
import { ApplicationError, ConflictError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"

describe("ClockIn", () => {
  test("creates an open attendance record", async () => {
    const context = createFakeAttendanceRecordRepository()

    const result = await new ClockIn(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    expect(result).toBeInstanceOf(AttendanceRecord)

    if (result instanceof ApplicationError) {
      throw new Error("expected attendance record")
    }

    expect(result.employeeId).toBe(toWorkforceEmployeeId(1))
    expect(result.clockInAt).toBe("2026-03-15T09:00:00.000Z")
    expect(result.status).toBe("open")
    expect(result.workDate).toBe("2026-03-15")
  })

  test("creates an attendance record with a note", async () => {
    const context = createFakeAttendanceRecordRepository()

    const result = await new ClockIn(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T09:00:00.000Z",
      note: "remote work",
    })

    if (result instanceof ApplicationError) {
      throw new Error("expected attendance record")
    }

    expect(result.note).toBe("remote work")
  })

  test("rejects duplicate clock in with already_clocked_in", async () => {
    const context = createFakeAttendanceRecordRepository()

    const first = await new ClockIn(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    if (first instanceof ApplicationError) {
      throw new Error("setup failed")
    }

    const second = await new ClockIn(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T10:00:00.000Z",
      note: null,
    })

    expectApplicationError(second, ConflictError, "already_clocked_in")
  })

  test("allows clock in for a different employee", async () => {
    const context = createFakeAttendanceRecordRepository()

    await new ClockIn(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    const result = await new ClockIn(context).run({
      employeeId: toWorkforceEmployeeId(2),
      now: "2026-03-15T09:05:00.000Z",
      note: null,
    })

    expect(result).toBeInstanceOf(AttendanceRecord)
  })

  test("allows clock in after previous record is closed", async () => {
    const context = createFakeAttendanceRecordRepository()

    const first = await new ClockIn(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    if (first instanceof ApplicationError) {
      throw new Error("setup failed")
    }

    await context.recordRepository.update(
      first.withClosed({
        clockOutAt: "2026-03-15T18:00:00.000Z",
        workMinutes: 540,
      }),
    )

    const second = await new ClockIn(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-16T09:00:00.000Z",
      note: null,
    })

    expect(second).toBeInstanceOf(AttendanceRecord)
  })

  test("maps a concurrent unique violation on insert to already_clocked_in", async () => {
    const context = createFakeAttendanceRecordRepository()

    const result = await new ClockIn({
      recordRepository: {
        findOpenByEmployeeId: context.recordRepository.findOpenByEmployeeId,
        create: async () => new UniqueConstraintError("employee already has an open record"),
      },
    }).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    expectApplicationError(result, ConflictError, "already_clocked_in")
  })

  test("maps a frozen record source to attendance_record_source_frozen", async () => {
    const context = createFakeAttendanceRecordRepository()

    const result = await new ClockIn({
      recordRepository: {
        findOpenByEmployeeId: context.recordRepository.findOpenByEmployeeId,
        create: async () => new AttendanceRecordSourceFrozenError(new Error("frozen")),
      },
    }).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    expectApplicationError(result, ConflictError, "attendance_record_source_frozen")
  })
})
