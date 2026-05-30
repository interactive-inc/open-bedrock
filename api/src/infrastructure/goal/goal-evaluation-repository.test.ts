import { GoalEvaluation } from "@/domain/goal/goal-evaluation"
import { GoalEvaluationRepository } from "@/infrastructure/goal/goal-evaluation-repository"
import { createTestContext } from "@/interface/shared/test/create-test-context"
import { describe, expect, test } from "bun:test"

describe("GoalEvaluationRepository", () => {
  test("create persists the evaluation and assigns an id", async () => {
    const { context } = createTestContext()

    const repository = new GoalEvaluationRepository(context)

    const created = await repository.create(
      GoalEvaluation.create({
        goalId: 1,
        evaluatorId: 2,
        kind: "self",
        score: 80,
        comment: "順調",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(GoalEvaluation)

    if (created instanceof Error) {
      throw created
    }

    expect(created.id).not.toBeNull()
    expect(created.kind).toBe("self")
    expect(created.score).toBe(80)
  })
})
