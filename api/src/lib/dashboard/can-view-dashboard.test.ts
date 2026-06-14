import { canViewDashboard } from "@/lib/dashboard/can-view-dashboard"
import { describe, expect, test } from "bun:test"

describe("canViewDashboard", () => {
  test("manager can view", () => {
    expect(canViewDashboard("manager")).toBe(true)
  })

  test("hr can view", () => {
    expect(canViewDashboard("hr")).toBe(true)
  })

  test("admin can view", () => {
    expect(canViewDashboard("admin")).toBe(true)
  })

  test("member cannot view", () => {
    expect(canViewDashboard("member")).toBe(false)
  })

  test("unknown role cannot view", () => {
    expect(canViewDashboard("viewer")).toBe(false)
  })
})
