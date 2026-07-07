import { canManagePartners } from "@/lib/partner/can-manage-partners"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManagePartners", () => {
  test("admin can manage", () => {
    expect(canManagePartners(makeTestSession("admin"))).toBe(true)
  })

  test("hr cannot manage", () => {
    expect(canManagePartners(makeTestSession("hr"))).toBe(false)
  })

  test("member cannot manage", () => {
    expect(canManagePartners(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManagePartners(makeTestSession("unknown"))).toBe(false)
  })
})
