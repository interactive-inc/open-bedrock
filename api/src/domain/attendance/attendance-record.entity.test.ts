import { AttendanceRecord } from "@/domain/attendance/attendance-record.entity"
import { describe, expect, test } from "bun:test"

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
