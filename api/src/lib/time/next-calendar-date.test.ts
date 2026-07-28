import { InvalidBusinessDateError } from "@/lib/time/invalid-business-date-error"
import { nextCalendarDate } from "@/lib/time/next-calendar-date"
import { describe, expect, test } from "bun:test"

describe("nextCalendarDate", () => {
  test("advances over month, leap-day, and year boundaries", () => {
    expect(nextCalendarDate("2026-01-31")).toBe("2026-02-01")
    expect(nextCalendarDate("2028-02-28")).toBe("2028-02-29")
    expect(nextCalendarDate("2025-12-31")).toBe("2026-01-01")
  })

  test("rejects non-canonical and impossible dates", () => {
    expect(nextCalendarDate("2026-1-1")).toBeInstanceOf(InvalidBusinessDateError)
    expect(nextCalendarDate("2026-02-30")).toBeInstanceOf(InvalidBusinessDateError)
  })
})
