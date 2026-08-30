import { canReadGoalOf } from "@/contexts/performance-review/domain/policies/goal-read-access.policy"
import { ResolveEmployeeRelationAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-employee-relation.adapter"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"
import { DeleteGoal } from "@/contexts/performance-review/application/goal/delete-goal"
import { UpdateGoal } from "@/contexts/performance-review/application/goal/update-goal"
import type { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppGoal } from "@/contexts/performance-review/interface/http/response-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { UnauthorizedError } from "@/lib/http/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 目標をレスポンス用スキーマで検証する。 */
function toResponseBody(goal: Goal) {
  return zAppGoal.parse({
    id: goal.id,
    employee_id: goal.employeeId,
    period: goal.period,
    title: goal.title,
    kpi: goal.kpi,
    weight: goal.weight,
    status: goal.status,
    owner_type: goal.ownerType,
    parent_goal_id: goal.parentGoalId,
    department_code: goal.departmentCode,
    evaluation_sheet_id: goal.evaluationSheetId,
  })
}

/** パスパラメータの goal_id を正の整数に変換する。不正値は 404。 */
function toGoalId(value: string | undefined): number {
  return validateIntParam(value, "goal")
}

// @authorization service - session を application service に渡して判定する
/** GET /performance-goals/:goalId — 目標の詳細（本人と goal:read:all 権限のみ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const goal = await (async () => {
    const command = {
      goalId: toGoalId(c.req.param("goalId") ?? ""),
      viewerEmployeeId: viewer.employeeId,
      session: viewer,
    }

    const repository = new GoalRepository(c)

    const goal = await repository.findById(command.goalId)

    if (goal instanceof Error) {
      return new UnexpectedError("failed to find goal", { cause: goal })
    }

    if (goal === null) {
      return new NotFoundError("goal not found", "goal_not_found")
    }

    const isOwner = goal.employeeId === command.viewerEmployeeId

    if (isOwner === false) {
      const relation = await new ResolveEmployeeRelationAdapter(c).resolveEmployeeRelation({
        viewerEmployeeId: command.viewerEmployeeId,
        targetEmployeeId: goal.employeeId,
      })

      if (relation instanceof Error) {
        return new UnexpectedError("failed to resolve employee relation", { cause: relation })
      }

      if (canReadGoalOf(command.session, relation) === false) {
        return new ForbiddenError("cannot view this goal", "not_viewable")
      }
    }

    return goal
  })()

  if (goal instanceof ApplicationError) {
    throw toHttpException(goal)
  }

  return c.json(toResponseBody(goal), 200)
})

// @authorization owner - 本人のリソースに限定する
/** PUT /performance-goals/:goalId — 目標の定義を変更（本人のみ・確定評価済みは不可） */
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      period: z.string().min(1).max(100),
      title: z.string().min(1).max(500),
      weight: z.number().int().min(1).max(100),
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
      goalId: toGoalId(c.req.param("goalId") ?? ""),
      employeeId: viewer.employeeId,
      period: json.period,
      title: json.title,
      kpi: json.kpi ?? null,
      weight: json.weight,
    })

    if (goal instanceof ApplicationError) {
      throw toHttpException(goal)
    }

    return c.json(toResponseBody(goal), 200)
  },
)

// @authorization owner - 本人のリソースに限定する
/** DELETE /performance-goals/:goalId — 目標を削除（本人のみ・確定評価済みは不可） */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const viewer = c.var.session

  if (viewer === null) {
    throw new UnauthorizedError()
  }

  const result = await new DeleteGoal(c).run({
    goalId: toGoalId(c.req.param("goalId") ?? ""),
    employeeId: viewer.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
