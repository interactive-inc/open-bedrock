import { GoalEvaluation } from "@/contexts/company/domain/goal/goal-evaluation.entity"
import { hasFinalEvaluation } from "@/contexts/company/application/goal/has-final-evaluation"
import { describe, expect, test } from "bun:test"

describe("hasFinalEvaluation", () => {
  test("returns true when array contains a final evaluation", () => {
    const selfEvaluation = GoalEvaluation.create({
      goalId: 1,
      evaluatorId: 10,
      kind: "self",
      score: 80,
      comment: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    const finalEvaluation = GoalEvaluation.create({
      goalId: 1,
      evaluatorId: 20,
      kind: "final",
      score: 85,
      comment: null,
      createdAt: "2026-06-02T00:00:00.000Z",
    })

    expect(hasFinalEvaluation([selfEvaluation, finalEvaluation])).toBe(true)
  })

  test("returns false when no final evaluation", () => {
    const selfEvaluation = GoalEvaluation.create({
      goalId: 1,
      evaluatorId: 10,
      kind: "self",
      score: 80,
      comment: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    const managerEvaluation = GoalEvaluation.create({
      goalId: 1,
      evaluatorId: 20,
      kind: "manager",
      score: 85,
      comment: null,
      createdAt: "2026-06-02T00:00:00.000Z",
    })

    expect(hasFinalEvaluation([selfEvaluation, managerEvaluation])).toBe(false)
  })

  test("returns false for empty array", () => {
    expect(hasFinalEvaluation([])).toBe(false)
  })
})
