import { canManageEmployees } from "@/lib/employee/can-manage-employees"
import { describe, expect, test } from "bun:test"

describe("canManageEmployees", () => {
  test("manager can manage", () => {
    expect(canManageEmployees("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageEmployees("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageEmployees("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageEmployees("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageEmployees("unknown")).toBe(false)
  })
})
