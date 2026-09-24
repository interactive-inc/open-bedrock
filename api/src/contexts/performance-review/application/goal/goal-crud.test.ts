import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeRelation } from "@/contexts/company/domain/definitions/employee-relation.definition"
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

const now = "2026-01-01T00:00:00.000Z"

const reportRelation: EmployeeRelation = { isSelf: false, isReport: true, isSameDepartment: true }

const unrelated: EmployeeRelation = { isSelf: false, isReport: false, isSameDepartment: true }

/**
 * 目標と目標評価のRepositoryを型付きfakeにする。採番、batch削除、評価シートのguard付きSQL、
 * 組織関係の解決は goal.repository.test.ts と performance-review/test/goal-evaluation.d1.test.ts が検証する。
 */
function createGoalPorts(options: { relation?: EmployeeRelation } = {}) {
  const goals = new Map<number, Goal>()
  const evaluations: GoalEvaluation[] = []

  const withId = (goal: Goal, id: number) =>
    new Goal({
      id,
      employeeId: goal.employeeId,
      period: goal.period,
      title: goal.title,
      kpi: goal.kpi,
      weight: goal.weight,
      status: goal.status,
      ownerType: goal.ownerType,
      parentGoalId: goal.parentGoalId,
      departmentCode: goal.departmentCode,
      evaluationSheetId: goal.evaluationSheetId,
    })

  const storeEvaluation = (evaluation: GoalEvaluation) => {
    const stored = new GoalEvaluation({
      id: evaluations.length + 1,
      goalId: evaluation.goalId,
      evaluatorId: evaluation.evaluatorId,
      kind: evaluation.kind,
      score: evaluation.score,
      comment: evaluation.comment,
      createdAt: evaluation.createdAt,
    })
    evaluations.push(stored)
    return stored
  }

  const unused = async (): Promise<never> => {
    throw new Error("evaluation sheet path is not used by these tests")
  }

  const goalRepository = {
    findById: async (goalId: number) => goals.get(goalId) ?? null,
    create: async (goal: Goal) => {
      const created = withId(goal, goals.size + 1)
      goals.set(goals.size + 1, created)
      return created
    },
    update: async (goal: Goal) => {
      if (goal.id === null || goals.get(goal.id)?.status === "done") return null
      goals.set(goal.id, goal)
      return goal
    },
    deleteWithEvaluations: async (goal: Goal) => {
      if (goal.id !== null) goals.delete(goal.id)
      return null
    },
    findEvaluationSheetState: async () => null,
    totalWeightForEvaluationSheet: unused,
    createForEvaluationSheet: unused,
    updateForEvaluationSheet: unused,
  }

  const goalEvaluationRepository = {
    findByGoalId: async (goalId: number) =>
      evaluations.filter((evaluation) => evaluation.goalId === goalId),
    create: async (evaluation: GoalEvaluation) => storeEvaluation(evaluation),
    createWithGoalCompletion: async (evaluation: GoalEvaluation, goal: Goal) => {
      if (goal.id !== null) goals.set(goal.id, goal.withStatus("done"))
      return storeEvaluation(evaluation)
    },
  }

  const ports = {
    goalRepository,
    goalEvaluationRepository,
    resolveEmployeeRelation: async () => options.relation ?? unrelated,
    now,
  }

  /** 確定評価済みの状態へ進める。status=done と final 評価を同時に持たせる。 */
  const finalize = (goal: Goal) => {
    if (goal.id === null) throw new Error("goal id is null")
    goals.set(goal.id, goal.withStatus("done"))
    storeEvaluation(
      GoalEvaluation.create({
        goalId: goal.id,
        evaluatorId: toWorkforceEmployeeId(1),
        kind: "final",
        score: 5,
        comment: "Good work",
        createdAt: now,
      }),
    )
  }

  return { ports, goals, evaluations, finalize }
}

type GoalPorts = ReturnType<typeof createGoalPorts>["ports"]

async function seedGoal(ports: GoalPorts, employeeId: number): Promise<Goal & { id: number }> {
  const result = await new CreateGoal(ports).run({
    employeeId: toWorkforceEmployeeId(employeeId),
    period: "2026-H1",
    title: "Improve test coverage",
    kpi: null,
    weight: 50,
  })

  if (result instanceof Error || result.id === null) {
    throw new Error("seed goal failed")
  }

  return result as Goal & { id: number }
}

describe("CreateGoal", () => {
  test("creates a goal", async () => {
    const { ports } = createGoalPorts()

    const result = await new CreateGoal(ports).run({
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
    const { ports } = createGoalPorts()

    const result = await new CreateGoal(ports).run({
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

describe("UpdateGoal", () => {
  test("updates for the owner", async () => {
    const { ports } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    const result = await new UpdateGoal(ports).run({
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
    const { ports, goals } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    const result = await new UpdateGoal(ports).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(2),
      period: "2026-H1",
      title: "Hijacked",
      kpi: null,
      weight: 50,
    })

    expectApplicationError(result, ForbiddenError, "not_owner")
    expect(goals.get(goal.id)?.title).toBe("Improve test coverage")
  })

  test("rejects unknown id with goal_not_found", async () => {
    const { ports } = createGoalPorts()

    const result = await new UpdateGoal(ports).run({
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
    const { ports, finalize } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    finalize(goal)

    const result = await new UpdateGoal(ports).run({
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
    const { ports, goals } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    const result = await new DeleteGoal(ports).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(1),
    })

    expect(result).toEqual({ reason: "deleted" })
    expect(goals.has(goal.id)).toBe(false)
  })

  test("rejects non-owner with not_owner", async () => {
    const { ports, goals } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    const result = await new DeleteGoal(ports).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(2),
    })

    expectApplicationError(result, ForbiddenError, "not_owner")
    expect(goals.has(goal.id)).toBe(true)
  })

  test("rejects unknown id with goal_not_found", async () => {
    const { ports } = createGoalPorts()

    const result = await new DeleteGoal(ports).run({
      goalId: 9999,
      employeeId: toWorkforceEmployeeId(1),
    })

    expectApplicationError(result, NotFoundError, "goal_not_found")
  })

  test("rejects finalized goal with goal_finalized", async () => {
    const { ports, goals, finalize } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    finalize(goal)

    const result = await new DeleteGoal(ports).run({
      goalId: goal.id,
      employeeId: toWorkforceEmployeeId(1),
    })

    expectApplicationError(result, ConflictError, "goal_finalized")
    expect(goals.has(goal.id)).toBe(true)
  })
})

describe("CreateGoalEvaluation", () => {
  test("creates a self evaluation for the owner", async () => {
    const { ports } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    const result = await new CreateGoalEvaluation(ports).run({
      goalId: goal.id,
      kind: "self",
      score: 4,
      comment: "I did well",
      evaluatorId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      createdAt: now,
    })

    expect(result).toBeInstanceOf(GoalEvaluation)

    if (result instanceof ApplicationError) {
      throw new Error("create evaluation failed")
    }

    expect(result.kind).toBe("self")
    expect(result.score).toBe(4)
  })

  test("rejects self evaluation by non-owner with forbidden", async () => {
    const { ports, evaluations } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    const result = await new CreateGoalEvaluation(ports).run({
      goalId: goal.id,
      kind: "self",
      score: 3,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(2),
      session: makeTestSession("member"),
      createdAt: now,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
    expect(evaluations).toEqual([])
  })

  test("creates a manager evaluation for the report's manager", async () => {
    const { ports } = createGoalPorts({ relation: reportRelation })
    const goal = await seedGoal(ports, 1)

    const result = await new CreateGoalEvaluation(ports).run({
      goalId: goal.id,
      kind: "manager",
      score: 5,
      comment: "Excellent",
      evaluatorId: toWorkforceEmployeeId(2),
      session: makeTestSession("manager", 2),
      createdAt: now,
    })

    expect(result).toBeInstanceOf(GoalEvaluation)
  })

  test("rejects a manager evaluation for a non-report", async () => {
    const { ports } = createGoalPorts({ relation: unrelated })
    const goal = await seedGoal(ports, 1)

    const result = await new CreateGoalEvaluation(ports).run({
      goalId: goal.id,
      kind: "manager",
      score: 5,
      comment: "Excellent",
      evaluatorId: toWorkforceEmployeeId(2),
      session: makeTestSession("manager", 2),
      createdAt: now,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects manager evaluation by member with forbidden", async () => {
    const { ports } = createGoalPorts({ relation: reportRelation })
    const goal = await seedGoal(ports, 1)

    const result = await new CreateGoalEvaluation(ports).run({
      goalId: goal.id,
      kind: "manager",
      score: 3,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(2),
      session: makeTestSession("member"),
      createdAt: now,
    })

    expectApplicationError(result, ForbiddenError, "forbidden")
  })

  test("rejects duplicate self evaluation with already_evaluated", async () => {
    const { ports } = createGoalPorts()
    const goal = await seedGoal(ports, 1)

    await new CreateGoalEvaluation(ports).run({
      goalId: goal.id,
      kind: "self",
      score: 4,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      createdAt: now,
    })

    const result = await new CreateGoalEvaluation(ports).run({
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
    const { ports } = createGoalPorts()

    const result = await new CreateGoalEvaluation(ports).run({
      goalId: 9999,
      kind: "self",
      score: 3,
      comment: null,
      evaluatorId: toWorkforceEmployeeId(1),
      session: makeTestSession("member"),
      createdAt: now,
    })

    expectApplicationError(result, NotFoundError, "goal_not_found")
  })
})
