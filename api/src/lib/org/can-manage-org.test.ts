import { canManageOrg } from "@/lib/org/can-manage-org"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageOrg", () => {
  test("hr can manage", () => {
    expect(canManageOrg(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageOrg(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot manage", () => {
    expect(canManageOrg(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManageOrg(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageOrg(makeTestSession("viewer"))).toBe(false)
  })
})
