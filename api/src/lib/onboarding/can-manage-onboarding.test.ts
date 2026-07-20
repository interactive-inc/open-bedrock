import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageOnboarding", () => {
  test("manager can manage", () => {
    expect(canManageOnboarding(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageOnboarding(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageOnboarding(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageOnboarding(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageOnboarding(makeTestSession("viewer"))).toBe(false)
  })
})
