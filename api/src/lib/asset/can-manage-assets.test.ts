import { canManageAssets } from "@/lib/asset/can-manage-assets"
import { describe, expect, test } from "bun:test"

describe("canManageAssets", () => {
  test("manager can manage", () => {
    expect(canManageAssets("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageAssets("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageAssets("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageAssets("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageAssets("unknown")).toBe(false)
  })
})
