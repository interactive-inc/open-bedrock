import { canManageTraining } from "@/lib/training/can-manage-training"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canManageTraining", () => {
  test("manager can manage", () => {
    expect(canManageTraining(makeTestSession("manager"))).toBe(true)
  })

  test("hr can manage", () => {
    expect(canManageTraining(makeTestSession("hr"))).toBe(true)
  })

  test("admin can manage", () => {
    expect(canManageTraining(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot manage", () => {
    expect(canManageTraining(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot manage", () => {
    expect(canManageTraining(makeTestSession("viewer"))).toBe(false)
  })
})
