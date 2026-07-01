import { canViewAllShiftSwaps } from "@/lib/shift/can-view-all-shift-swaps"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canViewAllShiftSwaps", () => {
  test("admin can view all", () => {
    expect(canViewAllShiftSwaps(makeTestSession("admin"))).toBe(true)
  })

  test("hr can view all", () => {
    expect(canViewAllShiftSwaps(makeTestSession("hr"))).toBe(true)
  })

  test("manager cannot view all", () => {
    expect(canViewAllShiftSwaps(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot view all", () => {
    expect(canViewAllShiftSwaps(makeTestSession("member"))).toBe(false)
  })
})
