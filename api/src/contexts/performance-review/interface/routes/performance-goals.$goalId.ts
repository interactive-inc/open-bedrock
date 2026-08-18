import { DeleteGoal } from "@/contexts/performance-review/application/goal/delete-goal"
import { GetGoal } from "@/contexts/performance-review/application/goal/get-goal"
import { UpdateGoal } from "@/contexts/performance-review/application/goal/update-goal"
import type { Goal } from "@/contexts/performance-review/domain/goal/goal.entity"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppGoal } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
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

  const goal = await new GetGoal(c).run({
    goalId: toGoalId(c.req.param("goalId") ?? ""),
    viewerEmployeeId: viewer.employeeId,
    session: viewer,
  })

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
