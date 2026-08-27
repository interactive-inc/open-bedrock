import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { GoalEvaluation } from "@/contexts/performance-review/domain/entities/goal-evaluation.entity"
import { describe, expect, test } from "bun:test"

describe("GoalEvaluation.create", () => {
  test("builds self evaluation with null id", () => {
    const evaluation = GoalEvaluation.create({
      goalId: 1,
      evaluatorId: toWorkforceEmployeeId(10),
      kind: "self",
      score: 80,
      comment: "自己評価コメント",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(evaluation).toBeInstanceOf(GoalEvaluation)
    expect(evaluation.id).toBe(null)
    expect(evaluation.goalId).toBe(1)
    expect(evaluation.evaluatorId).toBe(toWorkforceEmployeeId(10))
    expect(evaluation.kind).toBe("self")
    expect(evaluation.score).toBe(80)
    expect(evaluation.comment).toBe("自己評価コメント")
  })

  test("builds manager evaluation with null id", () => {
    const evaluation = GoalEvaluation.create({
      goalId: 2,
      evaluatorId: toWorkforceEmployeeId(20),
      kind: "manager",
      score: 90,
      comment: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(evaluation).toBeInstanceOf(GoalEvaluation)
    expect(evaluation.id).toBe(null)
    expect(evaluation.kind).toBe("manager")
    expect(evaluation.score).toBe(90)
    expect(evaluation.comment).toBe(null)
  })

  test("builds final evaluation with null id", () => {
    const evaluation = GoalEvaluation.create({
      goalId: 3,
      evaluatorId: toWorkforceEmployeeId(30),
      kind: "final",
      score: null,
      comment: "最終評価",
      createdAt: "2026-06-01T00:00:00.000Z",
    })

    expect(evaluation).toBeInstanceOf(GoalEvaluation)
    expect(evaluation.id).toBe(null)
    expect(evaluation.kind).toBe("final")
    expect(evaluation.score).toBe(null)
  })
})
