import { canManageShift } from "@/lib/shift/can-manage-shift"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageShift", () => {
  test("manager can manage", () => {
    expect(canManageShift(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageShift(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageShift(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageShift(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageShift(makeTestSession("unknown"))).toBe(false)
  })
})
