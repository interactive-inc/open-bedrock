import { canManageBatch } from "@/lib/batch/can-manage-batch"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageBatch", () => {
  test("manager can manage", () => {
    expect(canManageBatch(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageBatch(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageBatch(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageBatch(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageBatch(makeTestSession("viewer"))).toBe(false)
  })
})
