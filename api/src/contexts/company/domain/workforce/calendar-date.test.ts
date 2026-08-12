import {
  InvalidCalendarDateError,
  isCalendarDate,
  restoreCalendarDate,
} from "@/contexts/company/domain/workforce/calendar-date"
import { describe, expect, test } from "bun:test"

describe("CalendarDate", () => {
  test("accepts real canonical dates including leap day", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true)
    expect(String(restoreCalendarDate("2026-12-31"))).toBe("2026-12-31")
  })

  test("rejects impossible and non-canonical dates without runtime timezone", () => {
    for (const value of ["0000-01-01", "2025-02-29", "2026-13-01", "2026-1-01"]) {
      expect(isCalendarDate(value)).toBe(false)
      expect(() => restoreCalendarDate(value)).toThrow(InvalidCalendarDateError)
    }
  })
})
