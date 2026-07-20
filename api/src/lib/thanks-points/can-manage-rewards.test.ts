import { canManageRewards } from "@/lib/thanks-points/can-manage-rewards"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageRewards", () => {
  test("hr can manage", () => {
    expect(canManageRewards(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageRewards(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageRewards(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageRewards(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageRewards(makeTestSession("viewer"))).toBe(false)
  })
})
