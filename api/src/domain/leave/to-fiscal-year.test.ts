import { toFiscalYear } from "@/domain/leave/to-fiscal-year"
import { describe, expect, test } from "bun:test"

describe("toFiscalYear", () => {
  test("returns the calendar year for April through December", () => {
    expect(toFiscalYear("2026-04-01T00:00:00.000Z")).toBe("2026")
    expect(toFiscalYear("2026-06-15T00:00:00.000Z")).toBe("2026")
    expect(toFiscalYear("2026-12-31T23:59:59.000Z")).toBe("2026")
  })

  test("returns the previous year for January through March", () => {
    expect(toFiscalYear("2027-01-15T00:00:00.000Z")).toBe("2026")
    expect(toFiscalYear("2027-02-28T00:00:00.000Z")).toBe("2026")
    expect(toFiscalYear("2027-03-31T23:59:59.000Z")).toBe("2026")
  })

  test("returns an empty string for an invalid date", () => {
    expect(toFiscalYear("not-a-date")).toBe("")
  })
})
