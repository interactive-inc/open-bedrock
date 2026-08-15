import { toFiscalYear } from "@/contexts/company/domain/leave/to-fiscal-year"
import { describe, expect, test } from "bun:test"

describe("toFiscalYear", () => {
  test("returns the calendar year for April through December in JST", () => {
    expect(toFiscalYear("2026-04-01T00:00:00.000Z")).toBe("2026")
    expect(toFiscalYear("2026-06-15T00:00:00.000Z")).toBe("2026")
    expect(toFiscalYear("2026-12-01T00:00:00.000Z")).toBe("2026")
  })

  test("returns the previous year for January through March in JST", () => {
    expect(toFiscalYear("2027-01-15T00:00:00.000Z")).toBe("2026")
    expect(toFiscalYear("2027-02-28T00:00:00.000Z")).toBe("2026")
    expect(toFiscalYear("2027-03-15T00:00:00.000Z")).toBe("2026")
  })

  test("flips the fiscal year exactly at JST midnight on April 1st", () => {
    // UTC 2027-03-31T14:59:59 = JST 2027-03-31 23:59:59 → 2026 年度
    expect(toFiscalYear("2027-03-31T14:59:59.000Z")).toBe("2026")

    // UTC 2027-03-31T15:00:00 = JST 2027-04-01 00:00:00 → 2027 年度
    expect(toFiscalYear("2027-03-31T15:00:00.000Z")).toBe("2027")
  })

  test("treats JST early hours of January 1st as the current fiscal year", () => {
    // UTC 2026-12-31T16:00:00 = JST 2027-01-01 01:00:00 → 2026 年度
    expect(toFiscalYear("2026-12-31T16:00:00.000Z")).toBe("2026")
  })

  test("returns null for an invalid date", () => {
    expect(toFiscalYear("not-a-date")).toBeNull()
  })
})
