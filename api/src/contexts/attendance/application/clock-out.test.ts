import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"
import { ClockIn } from "@/contexts/attendance/application/clock-in"
import { ClockOut } from "@/contexts/attendance/application/clock-out"
import { ApplicationError, ConflictError } from "@/lib/errors"
import { createTestContext } from "@tests/api/support/create-test-context"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import type { Context } from "@/env"

async function seedOpenRecord(context: Context, employeeId: number): Promise<AttendanceRecord> {
  const result = await new ClockIn(context).run({
    employeeId: toWorkforceEmployeeId(employeeId),
    now: "2026-03-15T09:00:00.000Z",
    note: null,
  })

  if (result instanceof ApplicationError) {
    throw new Error("seed failed")
  }

  return result
}

describe("ClockOut", () => {
  test("closes the open record and calculates work minutes", async () => {
    const { context } = await createTestContext()

    await seedOpenRecord(context, 1)

    const result = await new ClockOut(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T18:00:00.000Z",
    })

    expect(result).toBeInstanceOf(AttendanceRecord)

    if (result instanceof ApplicationError) {
      throw new Error("expected attendance record")
    }

    expect(result.status).toBe("closed")
    expect(result.clockOutAt).toBe("2026-03-15T18:00:00.000Z")
    expect(result.workMinutes).toBe(540)
  })

  test("rejects when not clocked in with not_clocked_in", async () => {
    const { context } = await createTestContext()

    const result = await new ClockOut(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T18:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "not_clocked_in")
  })

  test("rejects double clock out with already_clocked_out", async () => {
    const { context } = await createTestContext()

    await seedOpenRecord(context, 1)

    const first = await new ClockOut(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T18:00:00.000Z",
    })

    if (first instanceof ApplicationError) {
      throw new Error("setup failed")
    }

    const second = await new ClockOut(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T19:00:00.000Z",
    })

    expectApplicationError(second, ConflictError, "not_clocked_in")
  })

  test("updates note on clock out", async () => {
    const { context } = await createTestContext()

    await seedOpenRecord(context, 1)

    const result = await new ClockOut(context).run({
      employeeId: toWorkforceEmployeeId(1),
      now: "2026-03-15T18:00:00.000Z",
      note: "left early",
    })

    if (result instanceof ApplicationError) {
      throw new Error("expected attendance record")
    }

    expect(result.note).toBe("left early")
  })
})
