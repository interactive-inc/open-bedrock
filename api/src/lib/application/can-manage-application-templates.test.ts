import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import { describe, expect, test } from "bun:test"

describe("canManageApplicationTemplates", () => {
  test("manager can manage", () => {
    expect(canManageApplicationTemplates("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageApplicationTemplates("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageApplicationTemplates("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageApplicationTemplates("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageApplicationTemplates("viewer")).toBe(false)
  })
})
