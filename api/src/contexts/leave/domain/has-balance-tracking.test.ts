import { hasLeaveBalanceTracking } from "@/contexts/leave/domain/has-balance-tracking"
import { describe, expect, test } from "bun:test"

describe("hasLeaveBalanceTracking", () => {
  test("returns true for balance-tracked leave types", () => {
    expect(hasLeaveBalanceTracking("annual")).toBe(true)
    expect(hasLeaveBalanceTracking("special")).toBe(true)
    expect(hasLeaveBalanceTracking("summer")).toBe(true)
    expect(hasLeaveBalanceTracking("child_nursing_care")).toBe(true)
    expect(hasLeaveBalanceTracking("caregiving_leave")).toBe(true)
  })

  test("returns false for leave types without balance tracking", () => {
    expect(hasLeaveBalanceTracking("compensatory")).toBe(false)
    expect(hasLeaveBalanceTracking("prenatal_checkup")).toBe(false)
    expect(hasLeaveBalanceTracking("menstrual")).toBe(false)
  })
})
