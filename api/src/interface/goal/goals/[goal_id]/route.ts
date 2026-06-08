import { DeleteGoal } from "@/application/goal/delete-goal"
import { GetGoal } from "@/application/goal/get-goal"
import { UpdateGoal } from "@/application/goal/update-goal"
import type { Goal } from "@/domain/goal/goal"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 目標をレスポンス用の snake_case に整形する。
function toResponseBody(goal: Goal) {
  return {
    id: goal.id,
    employee_id: goal.employeeId,
    period: goal.period,
    title: goal.title,
    kpi: goal.kpi,
    weight: goal.weight,
    status: goal.status,
  }
}

// パスパラメータの goal_id を数値へ。空や不正値は NaN になり後段で 404 になる。
function toGoalId(value: string | null): number {
  return Number(value ?? "")
}

// GET /goals/:goal_id — 目標の詳細（本人と特権ロールのみ）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const goal = await new GetGoal(c).run({
    goalId: toGoalId(c.req.param("goal_id") ?? ""),
    viewerEmployeeId: viewer.employeeId,
    viewerRole: viewer.role,
  })

  if (goal instanceof Error) {
    throw new InternalError("failed to load goal")
  }

  if ("reason" in goal) {
    if (goal.reason === "goal_not_found") {
      throw new NotFoundError("goal not found")
    }

    throw new ForbiddenError("not allowed to view this goal")
  }

  return c.json(toResponseBody(goal), 200)
})

// PUT /goals/:goal_id — 目標の定義を変更（本人のみ・確定評価済みは不可）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      period: z.string().min(1).max(100),
      title: z.string().min(1).max(500),
      weight: z.number(),
      kpi: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const viewer = c.var.session

    if (viewer === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const goal = await new UpdateGoal(c).run({
      goalId: toGoalId(c.req.param("goal_id") ?? ""),
      employeeId: viewer.employeeId,
      period: json.period,
      title: json.title,
      kpi: json.kpi ?? null,
      weight: json.weight,
    })

    if (goal instanceof Error) {
      throw new InternalError("failed to update goal")
    }

    if ("reason" in goal) {
      if (goal.reason === "goal_not_found") {
        throw new NotFoundError("goal not found")
      }

      if (goal.reason === "not_owner") {
        throw new ForbiddenError("not the goal owner")
      }

      throw new ConflictError("the goal is already finalized")
    }

    return c.json(toResponseBody(goal), 200)
  },
)

// DELETE /goals/:goal_id — 目標を削除（本人のみ・確定評価済みは不可）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteGoal(c).run({
    goalId: toGoalId(c.req.param("goal_id") ?? ""),
    employeeId: viewer.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete goal")
  }

  if (result.reason === "goal_not_found") {
    throw new NotFoundError("goal not found")
  }

  if (result.reason === "not_owner") {
    throw new ForbiddenError("not the goal owner")
  }

  if (result.reason === "goal_finalized") {
    throw new ConflictError("the goal is already finalized")
  }

  return c.body(null, 204)
})
