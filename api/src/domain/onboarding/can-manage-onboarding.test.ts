import { canManageOnboarding } from "@/domain/onboarding/can-manage-onboarding"
import { describe, expect, test } from "bun:test"

describe("canManageOnboarding", () => {
  test("manager can manage", () => {
    expect(canManageOnboarding("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageOnboarding("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageOnboarding("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageOnboarding("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageOnboarding("viewer")).toBe(false)
  })
})
