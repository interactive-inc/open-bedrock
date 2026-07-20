import { canAdministerCycle } from "@/lib/review/can-administer-cycle"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canAdministerCycle", () => {
  test("manager cannot administer company-wide cycles", () => {
    expect(canAdministerCycle(makeTestSession("manager"))).toBe(false)
  })

  test("hr can administer", () => {
    expect(canAdministerCycle(makeTestSession("hr"))).toBe(true)
  })

  test("admin can administer", () => {
    expect(canAdministerCycle(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot administer", () => {
    expect(canAdministerCycle(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot administer", () => {
    expect(canAdministerCycle(makeTestSession("unknown"))).toBe(false)
  })
})
