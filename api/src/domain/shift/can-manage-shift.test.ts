import { canManageShift } from "@/domain/shift/can-manage-shift"
import { describe, expect, test } from "bun:test"

describe("canManageShift", () => {
  test("manager can manage", () => {
    expect(canManageShift("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageShift("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageShift("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageShift("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageShift("unknown")).toBe(false)
  })
})
