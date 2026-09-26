import { testEmployeeId } from "@tests/api/support/test-identity-id"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { resolveCompanyEmployeeRelation } from "@/contexts/company/interface/operations/resolve-company-employee-relation"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { CreateGoal } from "@/contexts/performance-review/application/goal/create-goal"
import { CreateGoalEvaluation } from "@/contexts/performance-review/application/goal/create-goal-evaluation"
import { DeleteGoal } from "@/contexts/performance-review/application/goal/delete-goal"
import { GoalEvaluation } from "@/contexts/performance-review/domain/entities/goal-evaluation.entity"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal-evaluation.repository"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"
import type { Context } from "@/env"
import { ForbiddenError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { createLocalD1Context } from "@tests/d1/support/create-local-d1-context"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["manager-report", "non-report"] })
})

afterAll(async () => {
  await local.dispose()
})

/** routeと同じ実装をportへ組み立てる。 */
function goalPorts(context: Context) {
  return {
    goalRepository: new GoalRepository(context),
    goalEvaluationRepository: new GoalEvaluationRepository(context),
    resolveEmployeeRelation: (props: Parameters<typeof resolveCompanyEmployeeRelation>[1]) =>
      resolveCompanyEmployeeRelation(context, props),
    now: "2026-01-01T00:00:00.000Z",
  }
}

async function createGoal(context: Context): Promise<string> {
  const goal = await new CreateGoal(goalPorts(context)).run({
    employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
    period: "2026-H1",
    title: "Improve test coverage",
    kpi: null,
    weight: 50,
  })

  if (goal instanceof Error || goal.id === null) throw new Error("create goal failed")

  return goal.id
}

async function count(db: D1Database, table: "performance_goals" | "goal_evaluations") {
  const row = await db.prepare(`SELECT count(*) AS count FROM ${table}`).first<{ count: number }>()
  return row?.count ?? -1
}

describe("goal evaluation with company organization on local D1", () => {
  test("the report's manager evaluates the goal and the owner deletes it with its evaluations", async () => {
    const { context, db } = await createLocalD1Context(local, "manager-report")
    const goalId = await createGoal(context)

    await initializeCompanyTestFixture({
      db,
      employees: [
        { id: 2, code: "E002", name: "Manager", status: "active" },
        { id: 1, code: "E001", name: "Owner", status: "active" },
      ],
      departments: [{ id: 1, code: "D001", name: "Team", managerEmployeeCode: "E002" }],
      memberships: [
        { departmentCode: "D001", employeeCode: "E002", managerEmployeeCode: null },
        { departmentCode: "D001", employeeCode: "E001", managerEmployeeCode: "E002" },
      ],
    })

    const evaluation = await new CreateGoalEvaluation(goalPorts(context)).run({
      goalId,
      kind: "manager",
      score: 5,
      comment: "Excellent",
      evaluatorId: toWorkforceEmployeeId(testEmployeeId(2)),
      session: makeTestSession("manager", 2),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(evaluation).toBeInstanceOf(GoalEvaluation)
    expect(await count(db, "goal_evaluations")).toBe(1)

    const deleted = await new DeleteGoal(goalPorts(context)).run({
      goalId,
      employeeId: toWorkforceEmployeeId(testEmployeeId(1)),
    })

    expect(deleted).toEqual({ reason: "deleted" })
    expect(await count(db, "performance_goals")).toBe(0)
    expect(await count(db, "goal_evaluations")).toBe(0)
  })

  test("a manager outside the reporting line cannot evaluate the goal", async () => {
    const { context, db } = await createLocalD1Context(local, "non-report")
    const goalId = await createGoal(context)

    await initializeCompanyTestFixture({
      db,
      employees: [
        { id: 1, code: "E001", name: "Owner", status: "active" },
        { id: 2, code: "E002", name: "Viewer", status: "active" },
      ],
      departments: [{ id: 1, code: "D001", name: "Team" }],
    })

    const result = await new CreateGoalEvaluation(goalPorts(context)).run({
      goalId,
      kind: "manager",
      score: 5,
      comment: "Excellent",
      evaluatorId: toWorkforceEmployeeId(testEmployeeId(2)),
      session: makeTestSession("manager", 2),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
    expect(await count(db, "goal_evaluations")).toBe(0)
  })
})
