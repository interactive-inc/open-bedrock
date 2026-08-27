import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import { describe, expect, test } from "bun:test"
import { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import { GoalEvaluation } from "@/contexts/performance-review/domain/entities/goal-evaluation.entity"
import { CreateGoal } from "@/contexts/performance-review/application/goal/create-goal"
import { UpdateGoal } from "@/contexts/performance-review/application/goal/update-goal"
import { DeleteGoal } from "@/contexts/performance-review/application/goal/delete-goal"
import { CreateGoalEvaluation } from "@/contexts/performance-review/application/goal/create-goal-evaluation"
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors"
import { ApplicationError } from "@/lib/errors"
import { expectApplicationError } from "@tests/api/support/expect-application-error"
import { makeTestSession } from "@tests/api/support/make-test-session"
import { createTestContext } from "@tests/api/support/create-test-context"
import { initializeCompanyTestFixture } from "@tests/api/support/initialize-company-test-fixture"
import type { Context } from "@/env"

/** 目標の所有者(id=owner)を、上長(id=manager)のレポートライン配下にする最小の org を仕込む。 */
async function seedReportsTo(
  db: D1Database,
  props: { managerId: number; managerCode: string; ownerId: number; ownerCode: string },
): Promise<void> {
  const employees = [
    {
      id: props.managerId,
      code: props.managerCode,
      name: "Manager",
      dept_id: 1,
      status: "active",
    },
    { id: props.ownerId, code: props.ownerCode, name: "Owner", dept_id: 1, status: "active" },
  ] as const
  const memberships = [
    { departmentCode: "D001", employeeCode: props.managerCode, managerEmployeeCode: null },
    {
      departmentCode: "D001",
      employeeCode: props.ownerCode,
      managerEmployeeCode: props.managerCode,
    },
  ] as const

  await initializeCompanyTestFixture({
    db,
    employees,
    departments: [{ id: 1, code: "D001", name: "Team", managerEmployeeCode: props.managerCode }],
    memberships,
  })
}

async function seedIndependentEmployees(db: D1Database): Promise<void> {
  const employees = [
    { id: 1, code: "E001", name: "Owner", dept_id: 1, status: "active" },
    { id: 2, code: "E002", name: "Viewer", dept_id: 1, status: "active" },
  ] as const
  await initializeCompanyTestFixture({
    db,
    employees,
    departments: [{ id: 1, code: "D001", name: "Team" }],
  })
}

async function seedGoal(context: Context, employeeId: number): Promise<Goal> {
  const result = await new CreateGoal(context).run({
    employeeId: toWorkforceEmployeeId(employeeId),
    period: "2026-H1",
    title: "Improve test coverage",
    kpi: null,
    weight: 50,
  })

  if (result instanceof Error) {
    throw new Error("seed goal failed")
  }

  return result
}

async function finalizeGoal(context: Context, goal: Goal): Promise<void> {
  if (goal.id === null) {
    throw new Error("goal id is null")
  }

  await context.env.DB.prepare("UPDATE performance_goals SET status = 'done' WHERE id = ?1")
    .bind(goal.id)
    .run()
  await context.env.DB.prepare(
    `INSERT INTO goal_evaluations
       (goal_id, evaluator_id, kind, score, comment, created_at)
     VALUES (?1, '1', 'final', 5, 'Good work', '2026-01-01T00:00:00.000Z')`,
  )
    .bind(goal.id)
    .run()
}

describe("CreateGoal", () => {
  test("creates a goal", async () => {
    const { context } = await createTestContext()

    const result = await new CreateGoal(context).run({
      employeeId: toWorkforceEmployeeId(1),
      period: "2026-H1",
      title: "Learn TypeScript",
      kpi: null,
      weight: 30,
    })

    expect(result).toBeInstanceOf(Goal)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.title).toBe("Learn TypeScript")
    expect(result.status).toBe("draft")
  })

  test("creates a goal with KPI", async () => {
    const { context } = await createTestContext()

    const result = await new CreateGoal(context).run({
      employeeId: toWorkforceEmployeeId(1),
      period: "2026-H1",
      title: "Reduce bug count",
      kpi: "50% fewer critical bugs",
      weight: 40,
    })

    expect(result).toBeInstanceOf(Goal)

    if (result instanceof Error) {
      throw new Error("create failed")
    }

    expect(result.kpi).toBe("50% fewer critical bugs")
  })
})

describe("GetGoal", () => {})

describe("UpdateGoal", () => {
  test("updates for the owner", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new UpdateGoal(context).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(1),
      period: "2026-H2",
      title: "Updated title",
      kpi: "New KPI",
      weight: 60,
    })

    expect(result).toBeInstanceOf(Goal)

    if (result instanceof ApplicationError) {
      throw new Error("update failed")
    }

    expect(result.title).toBe("Updated title")
    expect(result.weight).toBe(60)
  })

  test("rejects non-owner with not_owner", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new UpdateGoal(context).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(2),
      period: "2026-H1",
      title: "Hijacked",
      kpi: null,
      weight: 50,
    })

    expectApplicationError(result, ForbiddenError, "not_owner")
  })

  test("rejects unknown id with goal_not_found", async () => {
    const { context } = await createTestContext()

    const result = await new UpdateGoal(context).run({
      goalId: 9999,
      employeeId: toWorkforceEmployeeId(1),
      period: "2026-H1",
      title: "Missing",
      kpi: null,
      weight: 50,
    })

    expectApplicationError(result, NotFoundError, "goal_not_found")
  })

  test("rejects finalized goal with goal_finalized", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    await finalizeGoal(context, goal)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new UpdateGoal(context).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(1),
      period: "2026-H1",
      title: "Too late",
      kpi: null,
      weight: 50,
    })

    expectApplicationError(result, ConflictError, "goal_finalized")
  })
})

describe("DeleteGoal", () => {
  test("deletes for the owner", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new DeleteGoal(context).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(1),
    })

    expect(result).toEqual({ reason: "deleted" })
  })

  test("rejects non-owner with not_owner", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new DeleteGoal(context).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(2),
    })

    expectApplicationError(result, ForbiddenError, "not_owner")
  })

  test("rejects unknown id with goal_not_found", async () => {
    const { context } = await createTestContext()

    const result = await new DeleteGoal(context).run({
      goalId: 9999,
      employeeId: toWorkforceEmployeeId(1),
    })

    expectApplicationError(result, NotFoundError, "goal_not_found")
  })

  test("rejects finalized goal with goal_finalized", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    await finalizeGoal(context, goal)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new DeleteGoal(context).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(1),
    })

    expectApplicationError(result, ConflictError, "goal_finalized")
  })
})

describe("ListMyGoals", () => {})

describe("ListGoalEvaluations", () => {})

describe("CreateGoalEvaluation", () => {
  test("creates a self evaluation for the owner", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new CreateGoalEvaluation(context).run({
      goalId: goal.id,
      kind: "self",
      score: 4,
      comment: "I did well",
      evaluatorId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(GoalEvaluation)

    if (result instanceof ApplicationError) {
      throw new Error("create evaluation failed")
    }

    expect(result.kind).toBe("self")
    expect(result.score).toBe(4)
  })

  test("rejects self evaluation by non-owner with forbidden", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new CreateGoalEvaluation(context).run({
      goalId: goal.id,
      kind: "self",
      score: 3,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(2),
      session: makeTestSession("member"),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("creates a manager evaluation for the report's manager", async () => {
    const { context, db } = await createTestContext()
    const goal = await seedGoal(context, 1)

    await seedReportsTo(db, { managerId: 2, managerCode: "E002", ownerId: 1, ownerCode: "E001" })

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new CreateGoalEvaluation(context).run({
      goalId: goal.id,
      kind: "manager",
      score: 5,
      comment: "Excellent",
      evaluatorId: toWorkforceEmployeeId(2),
      session: makeTestSession("manager", 2),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expect(result).toBeInstanceOf(GoalEvaluation)
  })

  test("rejects a manager evaluation for a non-report", async () => {
    const { context, db } = await createTestContext()
    const goal = await seedGoal(context, 1)
    await seedIndependentEmployees(db)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new CreateGoalEvaluation(context).run({
      goalId: goal.id,
      kind: "manager",
      score: 5,
      comment: "Excellent",
      evaluatorId: toWorkforceEmployeeId(2),
      session: makeTestSession("manager", 2),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects manager evaluation by member with forbidden", async () => {
    const { context, db } = await createTestContext()
    const goal = await seedGoal(context, 1)
    await seedIndependentEmployees(db)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    const result = await new CreateGoalEvaluation(context).run({
      goalId: goal.id,
      kind: "manager",
      score: 3,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(2),
      session: makeTestSession("member"),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects duplicate self evaluation with already_evaluated", async () => {
    const { context } = await createTestContext()
    const goal = await seedGoal(context, 1)

    if (goal.id === null) {
      throw new Error("id is null")
    }

    await new CreateGoalEvaluation(context).run({
      goalId: goal.id,
      kind: "self",
      score: 4,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    const result = await new CreateGoalEvaluation(context).run({
      goalId: goal.id,
      kind: "self",
      score: 3,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      createdAt: "2026-01-02T00:00:00.000Z",
    })

    expectApplicationError(result, ConflictError, "already_evaluated")
  })

  test("rejects evaluation on non-existent goal with goal_not_found", async () => {
    const { context } = await createTestContext()

    const result = await new CreateGoalEvaluation(context).run({
      goalId: 9999,
      kind: "self",
      score: 3,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      createdAt: "2026-01-01T00:00:00.000Z",
    })

    expectApplicationError(result, NotFoundError, "goal_not_found")
  })
})
