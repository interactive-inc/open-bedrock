import { countBusinessDays } from "@/contexts/company-calendar/domain/policies/count-business-days.policy"
import { describe, expect, test } from "bun:test"

describe("countBusinessDays", () => {
  test("counts weekdays only when there are no overrides", () => {
    // 2026-06 は平日 22 日。
    expect(countBusinessDays({ month: "2026-06", overrides: [] })).toBe(22)
  })

  test("excludes a company holiday that falls on a weekday", () => {
    const businessDays = countBusinessDays({
      month: "2026-06",
      overrides: [{ calendarDate: "2026-06-01", kind: "holiday" }],
    })

    expect(businessDays).toBe(21)
  })

  test("adds a workday that falls on a weekend", () => {
    // 2026-06-06 は土曜。振替出勤日として加算される。
    const businessDays = countBusinessDays({
      month: "2026-06",
      overrides: [{ calendarDate: "2026-06-06", kind: "workday" }],
    })

    expect(businessDays).toBe(23)
  })

  test("a workday override on a weekday is not double counted", () => {
    const businessDays = countBusinessDays({
      month: "2026-06",
      overrides: [{ calendarDate: "2026-06-02", kind: "workday" }],
    })

    expect(businessDays).toBe(22)
  })
})
