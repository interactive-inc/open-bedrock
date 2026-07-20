import { canEvaluateGoal } from "@/lib/goal/can-evaluate-goal"
import { makeTestSession } from "@/interface/test-helpers/make-test-session"
import { describe, expect, test } from "bun:test"

describe("canEvaluateGoal", () => {
  test("manager cannot evaluate all (scoped to reports since 0011)", () => {
    expect(canEvaluateGoal(makeTestSession("manager"))).toBe(false)
  })

  test("hr can evaluate", () => {
    expect(canEvaluateGoal(makeTestSession("hr"))).toBe(true)
  })

  test("admin can evaluate", () => {
    expect(canEvaluateGoal(makeTestSession("admin"))).toBe(true)
  })

  test("member cannot evaluate", () => {
    expect(canEvaluateGoal(makeTestSession("member"))).toBe(false)
  })

  test("unknown role cannot evaluate", () => {
    expect(canEvaluateGoal(makeTestSession("viewer"))).toBe(false)
  })
})
