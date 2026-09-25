import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { GoalEvaluation } from "@/contexts/performance-review/domain/entities/goal-evaluation.entity"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal-evaluation.repository"
import { seedD1 } from "@tests/api/support/seed-d1"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { startLocalD1, type LocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({
    migrated: ["create-persists-the-evaluation-and-assigns-an"],
  })
})

afterAll(async () => {
  await local.dispose()
})

describe("GoalEvaluationRepository", () => {
  test("create persists the evaluation and assigns an id", async () => {
    const { context, db } = await createLocalD1Context(
      local,
      "create-persists-the-evaluation-and-assigns-an",
    )

    await seedD1(db, "performance_goals", [
      {
        id: "01900030-0000-7000-8000-000000000001",
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
        goalId: "01900030-0000-7000-8000-000000000001",
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
