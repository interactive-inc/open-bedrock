import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { GoalEvaluation } from "@/contexts/performance-review/domain/entities/goal-evaluation.entity"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal-evaluation.repository"
import { createTestContext } from "@tests/api/support/create-test-context"
import { seedD1 } from "@tests/api/support/seed-d1"
import { describe, expect, test } from "bun:test"

describe("GoalEvaluationRepository", () => {
  test("create persists the evaluation and assigns an id", async () => {
    const { context, db } = await createTestContext()

    await seedD1(db, "performance_goals", [
      {
        id: 1,
        employee_id: "2",
        period: "2026-H1",
        title: "テスト目標",
        kpi: null,
        weight: 100,
        status: "in_progress",
      },
    ])

    const repository = new GoalEvaluationRepository(context)

    const created = await repository.create(
      GoalEvaluation.create({
        goalId: 1,
        evaluatorId: toWorkforceEmployeeId(2),
        kind: "self",
        score: 80,
        comment: "順調",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    )

    expect(created).toBeInstanceOf(GoalEvaluation)

    if (created instanceof Error || "reason" in created) {
      throw new Error("create failed")
    }

    expect(created.id).not.toBeNull()
    expect(created.kind).toBe("self")
    expect(created.score).toBe(80)
  })
})
