import { canViewEmployeeOnboarding } from "@/domain/onboarding/can-view-employee-onboarding"
import { describe, expect, test } from "bun:test"

describe("canViewEmployeeOnboarding", () => {
  test("manager can view", () => {
    expect(canViewEmployeeOnboarding({ viewerRole: "manager" })).toBe(true)
  })

  test("hr can view", () => {
    expect(canViewEmployeeOnboarding({ viewerRole: "hr" })).toBe(true)
  })

  test("admin can view", () => {
    expect(canViewEmployeeOnboarding({ viewerRole: "admin" })).toBe(true)
  })

  test("member cannot view", () => {
    expect(canViewEmployeeOnboarding({ viewerRole: "member" })).toBe(false)
  })

  test("unknown role cannot view", () => {
    expect(canViewEmployeeOnboarding({ viewerRole: "viewer" })).toBe(false)
  })
})
