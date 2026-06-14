import { canManageOrg } from "@/lib/org/can-manage-org"
import { describe, expect, test } from "bun:test"

describe("canManageOrg", () => {
  test("hr can manage", () => {
    expect(canManageOrg("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageOrg("admin")).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageOrg("manager")).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageOrg("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageOrg("viewer")).toBe(false)
  })
})
