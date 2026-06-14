import { canManageTraining } from "@/lib/training/can-manage-training"
import { describe, expect, test } from "bun:test"

describe("canManageTraining", () => {
  test("manager can manage", () => {
    expect(canManageTraining("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageTraining("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageTraining("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageTraining("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageTraining("viewer")).toBe(false)
  })
})
