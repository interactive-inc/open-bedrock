import { canAdministerCycle } from "@/lib/review/can-administer-cycle"
import { describe, expect, test } from "bun:test"

describe("canAdministerCycle", () => {
  test("manager can administer", () => {
    expect(canAdministerCycle("manager")).toBe(true)
  })

  test("hr can administer", () => {
    expect(canAdministerCycle("hr")).toBe(true)
  })

  test("admin can administer", () => {
    expect(canAdministerCycle("admin")).toBe(true)
  })

  test("member cannot administer", () => {
    expect(canAdministerCycle("member")).toBe(false)
  })

  test("unknown role cannot administer", () => {
    expect(canAdministerCycle("unknown")).toBe(false)
  })
})
