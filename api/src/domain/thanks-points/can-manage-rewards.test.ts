import { canManageRewards } from "@/domain/thanks-points/can-manage-rewards"
import { describe, expect, test } from "bun:test"

describe("canManageRewards", () => {
  test("hr can manage", () => {
    expect(canManageRewards("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageRewards("admin")).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageRewards("manager")).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageRewards("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageRewards("viewer")).toBe(false)
  })
})
