import { canViewDashboard } from "@/lib/dashboard/can-view-dashboard"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canViewDashboard", () => {
  test("manager can view", () => {
    expect(canViewDashboard(makeTestSession("manager"))).toBe(true)
  })

  test("hr can view", () => {
    expect(canViewDashboard(makeTestSession("hr"))).toBe(true)
  })

  test("admin can view", () => {
    expect(canViewDashboard(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot view", () => {
    expect(canViewDashboard(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot view", () => {
    expect(canViewDashboard(makeTestSession("viewer"))).toBe(false)
  })
})
