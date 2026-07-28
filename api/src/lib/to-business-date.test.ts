import { toBusinessDate } from "@/lib/to-business-date"
import { toBusinessMonth } from "@/lib/to-business-month"
import { describe, expect, test } from "bun:test"

describe("toBusinessDate", () => {
  test("keeps the same date for a daytime UTC instant", () => {
    expect(toBusinessDate("2026-03-15T09:00:00.000Z")).toBe("2026-03-15")
  })

  test("returns the next day at the JST day boundary (UTC 15:00 = JST 00:00)", () => {
    expect(toBusinessDate("2026-03-15T15:00:00.000Z")).toBe("2026-03-16")
  })

  test("returns the next day for JST early morning (UTC 23:59 = JST 08:59)", () => {
    expect(toBusinessDate("2026-03-15T23:59:00.000Z")).toBe("2026-03-16")
  })

  test("stays on the same day just before the JST boundary (UTC 14:59 = JST 23:59)", () => {
    expect(toBusinessDate("2026-03-15T14:59:00.000Z")).toBe("2026-03-15")
  })

  test("rolls over month and year at the JST boundary", () => {
    expect(toBusinessDate("2025-12-31T15:00:00.000Z")).toBe("2026-01-01")
  })
})

describe("toBusinessMonth", () => {
  test("returns YYYY-MM in JST", () => {
    expect(toBusinessMonth("2026-03-15T09:00:00.000Z")).toBe("2026-03")
  })

  test("rolls into the next month at the JST boundary (UTC last-day 15:00)", () => {
    expect(toBusinessMonth("2026-03-31T15:00:00.000Z")).toBe("2026-04")
  })
})
