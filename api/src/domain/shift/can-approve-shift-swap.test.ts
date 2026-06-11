import { canApproveShiftSwap } from "@/domain/shift/can-approve-shift-swap"
import { describe, expect, test } from "bun:test"

describe("canApproveShiftSwap", () => {
  test("manager can approve", () => {
    expect(canApproveShiftSwap("manager")).toBe(true)
  })

  test("hr can approve", () => {
    expect(canApproveShiftSwap("hr")).toBe(true)
  })

  test("admin can approve", () => {
    expect(canApproveShiftSwap("admin")).toBe(true)
  })

  test("member cannot approve", () => {
    expect(canApproveShiftSwap("member")).toBe(false)
  })

  test("unknown role cannot approve", () => {
    expect(canApproveShiftSwap("unknown")).toBe(false)
  })
})
