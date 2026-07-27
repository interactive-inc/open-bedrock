import { toMonthRange } from "@/interface/routes/attendance-records/to-month-range"
import { describe, expect, test } from "bun:test"

describe("toMonthRange", () => {
  test("returns 31 days for January", () => {
    const range = toMonthRange("2026-01")
    expect(range.from).toBe("2026-01-01")
    expect(range.to).toBe("2026-01-31")
  })

  test("returns 28 days for February in a non-leap year", () => {
    const range = toMonthRange("2025-02")
    expect(range.from).toBe("2025-02-01")
    expect(range.to).toBe("2025-02-28")
  })

  test("returns 29 days for February in a leap year", () => {
    const range = toMonthRange("2024-02")
    expect(range.from).toBe("2024-02-01")
    expect(range.to).toBe("2024-02-29")
  })

  test("returns 30 days for April", () => {
    const range = toMonthRange("2026-04")
    expect(range.from).toBe("2026-04-01")
    expect(range.to).toBe("2026-04-30")
  })

  test("returns 30 days for June", () => {
    const range = toMonthRange("2026-06")
    expect(range.from).toBe("2026-06-01")
    expect(range.to).toBe("2026-06-30")
  })

  test("returns 30 days for September", () => {
    const range = toMonthRange("2026-09")
    expect(range.from).toBe("2026-09-01")
    expect(range.to).toBe("2026-09-30")
  })

  test("returns 30 days for November", () => {
    const range = toMonthRange("2026-11")
    expect(range.from).toBe("2026-11-01")
    expect(range.to).toBe("2026-11-30")
  })

  test("returns 31 days for December", () => {
    const range = toMonthRange("2026-12")
    expect(range.from).toBe("2026-12-01")
    expect(range.to).toBe("2026-12-31")
  })

  test("preserves the month field unchanged", () => {
    const range = toMonthRange("2026-03")
    expect(range.month).toBe("2026-03")
  })
})
