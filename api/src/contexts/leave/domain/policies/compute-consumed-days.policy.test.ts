import { computeConsumedDays } from "@/contexts/leave/domain/policies/compute-consumed-days.policy"
import { describe, expect, test } from "bun:test"

describe("computeConsumedDays", () => {
  test("returns days as-is for full_day", () => {
    expect(computeConsumedDays({ unit: "full_day", hours: null, days: 3 })).toBe(3)
  })

  test("returns 0.5 for a half day regardless of days", () => {
    expect(computeConsumedDays({ unit: "half_day_am", hours: null, days: 1 })).toBe(0.5)
    expect(computeConsumedDays({ unit: "half_day_pm", hours: null, days: 1 })).toBe(0.5)
  })

  test("converts hourly to a day fraction using an 8-hour workday", () => {
    expect(computeConsumedDays({ unit: "hourly", hours: 2, days: 1 })).toBe(0.25)
    expect(computeConsumedDays({ unit: "hourly", hours: 8, days: 1 })).toBe(1)
  })

  test("treats missing hours as zero consumption for hourly", () => {
    expect(computeConsumedDays({ unit: "hourly", hours: null, days: 1 })).toBe(0)
  })
})
