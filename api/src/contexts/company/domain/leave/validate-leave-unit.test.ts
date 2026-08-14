import { validateLeaveUnit } from "@/contexts/company/domain/leave/validate-leave-unit"
import { describe, expect, test } from "bun:test"

describe("validateLeaveUnit", () => {
  test("returns an error when hourly has no hours", () => {
    const result = validateLeaveUnit({
      unit: "hourly",
      hours: null,
      startDate: "2026-06-01",
      endDate: "2026-06-01",
    })

    expect(result).toBeInstanceOf(Error)
  })

  test("returns null when hourly has hours", () => {
    const result = validateLeaveUnit({
      unit: "hourly",
      hours: 2,
      startDate: "2026-06-01",
      endDate: "2026-06-01",
    })

    expect(result).toBeNull()
  })

  test("returns an error when a half day spans multiple dates", () => {
    const result = validateLeaveUnit({
      unit: "half_day_am",
      hours: null,
      startDate: "2026-06-01",
      endDate: "2026-06-02",
    })

    expect(result).toBeInstanceOf(Error)
  })

  test("returns null when a half day is a single date", () => {
    const result = validateLeaveUnit({
      unit: "half_day_pm",
      hours: null,
      startDate: "2026-06-01",
      endDate: "2026-06-01",
    })

    expect(result).toBeNull()
  })

  test("returns null for full_day regardless of the date range", () => {
    const result = validateLeaveUnit({
      unit: "full_day",
      hours: null,
      startDate: "2026-06-01",
      endDate: "2026-06-03",
    })

    expect(result).toBeNull()
  })
})
