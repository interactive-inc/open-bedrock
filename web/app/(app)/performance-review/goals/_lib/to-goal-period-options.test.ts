import { describe, expect, test } from "vite-plus/test"
import { toGoalPeriodOptions } from "@/app/(app)/performance-review/goals/_lib/to-goal-period-options"

describe("toGoalPeriodOptions", () => {
  test("keeps the periods in chronological order", () => {
    const options = toGoalPeriodOptions(["2026-H1", "2025-H2", "2026-H2"], null)

    expect(options.map((option) => option.value)).toStrictEqual(["2025-H2", "2026-H1", "2026-H2"])
  })

  test("labels the year and the half in Japanese", () => {
    const options = toGoalPeriodOptions(["2026-H1", "2026-H2"], null)

    expect(options[0]?.label).toBe("2026-H1（2026年上期）")
    expect(options[1]?.label).toBe("2026-H2（2026年下期）")
  })

  test("keeps a selected period that the list does not cover", () => {
    const options = toGoalPeriodOptions(["2026-H1"], "2024-H1")

    expect(options.map((option) => option.value)).toStrictEqual(["2024-H1", "2026-H1"])
  })

  test("labels an unknown format as the raw value", () => {
    const options = toGoalPeriodOptions([], "FY26-Q3")

    expect(options[0]?.label).toBe("FY26-Q3")
  })

  test("does not duplicate a selected period already in the list", () => {
    const options = toGoalPeriodOptions(["2026-H1"], "2026-H1")

    expect(options).toHaveLength(1)
  })

  test("drops duplicates coming from the list itself", () => {
    const options = toGoalPeriodOptions(["2026-H1", "2026-H1"], null)

    expect(options).toHaveLength(1)
  })

  test("ignores an empty selection instead of adding a blank option", () => {
    const options = toGoalPeriodOptions(["2026-H1"], "")

    expect(options.every((option) => option.value !== "")).toBe(true)
  })

  test("returns an empty list when there is no period and no selection", () => {
    expect(toGoalPeriodOptions([], null)).toStrictEqual([])
  })
})
