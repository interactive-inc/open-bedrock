import { canManageEmployees } from "@/lib/employee/can-manage-employees"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageEmployees", () => {
  test("manager can manage", () => {
    expect(canManageEmployees(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageEmployees(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageEmployees(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageEmployees(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageEmployees(makeTestSession("unknown"))).toBe(false)
  })
})
