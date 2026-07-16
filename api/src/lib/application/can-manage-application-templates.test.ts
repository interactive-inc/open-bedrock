import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageApplicationTemplates", () => {
  test("manager cannot manage company-wide templates", () => {
    expect(canManageApplicationTemplates(makeTestSession("manager"))).toBe(false)
  })

  test("hr can manage", () => {
    expect(canManageApplicationTemplates(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageApplicationTemplates(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageApplicationTemplates(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageApplicationTemplates(makeTestSession("viewer"))).toBe(false)
  })
})
