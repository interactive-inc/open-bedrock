import { canDeleteEmployee } from "@/domain/employee/can-delete-employee"
import { describe, expect, test } from "bun:test"

describe("canDeleteEmployee", () => {
  test("hr can delete", () => {
    expect(canDeleteEmployee("hr")).toBe(true)
  })

  test("admin can delete", () => {
    expect(canDeleteEmployee("admin")).toBe(true)
  })

  test("manager cannot delete", () => {
    expect(canDeleteEmployee("manager")).toBe(false)
  })

  test("member cannot delete", () => {
    expect(canDeleteEmployee("member")).toBe(false)
  })

  test("unknown role cannot delete", () => {
    expect(canDeleteEmployee("unknown")).toBe(false)
  })
})
