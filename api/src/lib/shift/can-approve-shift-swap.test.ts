import { canApproveShiftSwap } from "@/lib/shift/can-approve-shift-swap"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canApproveShiftSwap", () => {
  test("manager can approve", () => {
    expect(canApproveShiftSwap(makeTestSession("manager"))).toBe(true)
  })

  test("hr can approve", () => {
    expect(canApproveShiftSwap(makeTestSession("hr"))).toBe(true)
  })

  test("admin can approve", () => {
    expect(canApproveShiftSwap(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot approve", () => {
    expect(canApproveShiftSwap(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot approve", () => {
    expect(canApproveShiftSwap(makeTestSession("unknown"))).toBe(false)
  })
})
