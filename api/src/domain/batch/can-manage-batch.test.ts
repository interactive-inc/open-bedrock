import { canManageBatch } from "@/domain/batch/can-manage-batch"
import { describe, expect, test } from "bun:test"

describe("canManageBatch", () => {
  test("manager can manage", () => {
    expect(canManageBatch("manager")).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageBatch("hr")).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageBatch("admin")).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageBatch("member")).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageBatch("viewer")).toBe(false)
  })
})
