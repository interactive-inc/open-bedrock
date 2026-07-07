import { toOvertimeEntries } from "@/interface/attendance/overtime-summary/to-overtime-entries"
import { describe, expect, test } from "bun:test"

describe("toOvertimeEntries", () => {
  test("aggregates work minutes per employee and computes overtime beyond the cap", () => {
    // 営業日 2 日 × 480 分 = 960 分が所定。従業員 1 は 1080 分 = 120 分の時間外。
    const entries = toOvertimeEntries({
      rows: [
        { employeeId: 1, workMinutes: 600 },
        { employeeId: 1, workMinutes: 480 },
        { employeeId: 2, workMinutes: 400 },
      ],
      businessDays: 2,
      dailyRegularMinutes: 480,
    })

    expect(entries.length).toBe(2)

    const first = entries[0]

    expect(first?.employeeId).toBe(1)
    expect(first?.workDays).toBe(2)
    expect(first?.totalWorkMinutes).toBe(1080)
    expect(first?.overtimeMinutes).toBe(120)

    const second = entries[1]

    expect(second?.employeeId).toBe(2)
    expect(second?.overtimeMinutes).toBe(0)
  })

  test("null work minutes rows do not count as work days and add no minutes", () => {
    const entries = toOvertimeEntries({
      rows: [
        { employeeId: 1, workMinutes: null },
        { employeeId: 1, workMinutes: 500 },
      ],
      businessDays: 0,
      dailyRegularMinutes: 480,
    })

    expect(entries.length).toBe(1)
    expect(entries[0]?.workDays).toBe(1)
    expect(entries[0]?.totalWorkMinutes).toBe(500)
    expect(entries[0]?.overtimeMinutes).toBe(500)
  })
})
