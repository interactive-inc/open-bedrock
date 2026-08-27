import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { AttendanceRecord } from "@/contexts/attendance/domain/entities/attendance-record.entity"
import { describe, expect, test } from "bun:test"

describe("AttendanceRecord.create", () => {
  test("uses the clock-in date as work date for a daytime instant", () => {
    const record = AttendanceRecord.create({
      employeeId: toWorkforceEmployeeId(1),
      clockInAt: "2026-03-15T09:00:00.000Z",
      note: null,
    })

    expect(record.workDate).toBe("2026-03-15")
  })

  test("resolves work date in JST so early-morning clock-in is not the previous day", () => {
    // UTC 2026-03-14T23:30 = JST 2026-03-15 08:30 の出勤。UTC 日付では前日になる。
    const record = AttendanceRecord.create({
      employeeId: toWorkforceEmployeeId(1),
      clockInAt: "2026-03-14T23:30:00.000Z",
      note: null,
    })

    expect(record.workDate).toBe("2026-03-15")
  })

  test("resolves work date in JST at the day boundary (UTC 15:00 = JST 00:00)", () => {
    const record = AttendanceRecord.create({
      employeeId: toWorkforceEmployeeId(1),
      clockInAt: "2026-03-15T15:00:00.000Z",
      note: null,
    })

    expect(record.workDate).toBe("2026-03-16")
  })
})

describe("AttendanceRecord.toWorkMinutes", () => {
  test("returns the difference in minutes between clockIn and clockOut", () => {
    const workMinutes = AttendanceRecord.toWorkMinutes({
      clockInAt: "2026-06-10T09:00:00.000Z",
      clockOutAt: "2026-06-10T17:30:00.000Z",
    })

    expect(workMinutes).toBe(510) // 8h30m = 510 min
  })

  test("returns 0 when clockIn and clockOut are the same", () => {
    const workMinutes = AttendanceRecord.toWorkMinutes({
      clockInAt: "2026-06-10T09:00:00.000Z",
      clockOutAt: "2026-06-10T09:00:00.000Z",
    })

    expect(workMinutes).toBe(0)
  })

  test("returns an Error when clockOutAt is before clockInAt", () => {
    const workMinutes = AttendanceRecord.toWorkMinutes({
      clockInAt: "2026-06-10T17:00:00.000Z",
      clockOutAt: "2026-06-10T09:00:00.000Z",
    })

    expect(workMinutes).toBeInstanceOf(Error)

    if (workMinutes instanceof Error) {
      expect(workMinutes.message).toBe("clockOutAt is before clockInAt")
    }
  })

  test("returns an Error when clockInAt is invalid", () => {
    const workMinutes = AttendanceRecord.toWorkMinutes({
      clockInAt: "not-a-date",
      clockOutAt: "2026-06-10T17:00:00.000Z",
    })

    expect(workMinutes).toBeInstanceOf(Error)

    if (workMinutes instanceof Error) {
      expect(workMinutes.message).toContain("invalid clockInAt")
    }
  })

  test("returns an Error when clockOutAt is invalid", () => {
    const workMinutes = AttendanceRecord.toWorkMinutes({
      clockInAt: "2026-06-10T09:00:00.000Z",
      clockOutAt: "not-a-date",
    })

    expect(workMinutes).toBeInstanceOf(Error)

    if (workMinutes instanceof Error) {
      expect(workMinutes.message).toContain("invalid clockOutAt")
    }
  })
})
