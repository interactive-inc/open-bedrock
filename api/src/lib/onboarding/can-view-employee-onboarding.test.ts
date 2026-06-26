import { canViewEmployeeOnboarding } from "@/lib/onboarding/can-view-employee-onboarding"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canViewEmployeeOnboarding", () => {
  test("manager can view", () => {
    expect(canViewEmployeeOnboarding(makeTestSession("manager"))).toBe(true)
  })

  test("hr can view", () => {
    expect(canViewEmployeeOnboarding(makeTestSession("hr"))).toBe(true)
  })

  test("admin can view", () => {
    expect(canViewEmployeeOnboarding(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot view", () => {
    expect(canViewEmployeeOnboarding(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot view", () => {
    expect(canViewEmployeeOnboarding(makeTestSession("viewer"))).toBe(false)
  })
})
