import { canDeleteEmployee } from "@/lib/employee/can-delete-employee"
import { makeTestSession } from "@/interface/shared/test/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canDeleteEmployee", () => {
  test("hr can delete", () => {
    expect(canDeleteEmployee(makeTestSession("hr"))).toBe(true)
  })

  test("admin can delete", () => {
    expect(canDeleteEmployee(makeTestSession("admin"))).toBe(true)
  })

  test("manager cannot delete", () => {
    expect(canDeleteEmployee(makeTestSession("manager"))).toBe(false)
  })

  test("member cannot delete", () => {
    expect(canDeleteEmployee(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot delete", () => {
    expect(canDeleteEmployee(makeTestSession("unknown"))).toBe(false)
  })
})
