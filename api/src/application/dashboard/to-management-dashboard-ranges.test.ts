import { describe, expect, test } from "bun:test"
import { toManagementDashboardRanges } from "@/application/dashboard/to-management-dashboard-ranges"

describe("toManagementDashboardRanges", () => {
  test("derives the current month prefix and the 30-day lower bound", () => {
    const ranges = toManagementDashboardRanges("2026-06-15T00:00:00.000Z")

    expect(ranges.monthPrefix).toBe("2026-06")
    expect(ranges.since).toBe("2026-05-16")
  })

  test("handles month boundaries", () => {
    const ranges = toManagementDashboardRanges("2026-01-05T12:00:00.000Z")

    expect(ranges.monthPrefix).toBe("2026-01")
    expect(ranges.since).toBe("2025-12-06")
  })
})
