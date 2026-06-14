import { canManagePayroll } from "@/lib/payroll/payroll-access"
import { describe, expect, test } from "bun:test"

describe("canManagePayroll", () => {
  test("manager can manage", () => {
    expect(canManagePayroll("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManagePayroll("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManagePayroll("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManagePayroll("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManagePayroll("viewer")).toBe(false)
  })
})
