import { CreateGoalEvaluation } from "@/contexts/performance-review/application/goal/create-goal-evaluation"
import { ListGoalEvaluations } from "@/contexts/performance-review/application/goal/list-goal-evaluations"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { goalEvaluationKindSchema } from "@/contexts/performance-review/domain/goal/goal-evaluation.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppGoalEvaluation, zAppGoalEvaluationList } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { validateIntParam } from "@/contexts/company-compatibility/interface/utils/validate-int-param"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** GET /performance-goals/:goal_id/evaluations — 目標に紐づく評価の一覧（閲覧権限は GET /performance-goals/:goal_id と同じ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const goalId = validateIntParam(c.req.param("goal_id"), "goal")

  const evaluations = await new ListGoalEvaluations(c).run({
    goalId,
    viewerEmployeeId: session.employeeId,
    session: session,
  })

  if (evaluations instanceof ApplicationError) {
    throw toHttpException(evaluations)
  }

  const responseBody = zAppGoalEvaluationList.parse(
    evaluations.map((evaluation) => ({
      id: evaluation.id,
      goal_id: evaluation.goalId,
      evaluator_id: evaluation.evaluatorId,
      kind: evaluation.kind,
      score: evaluation.score,
      comment: evaluation.comment,
      created_at: evaluation.createdAt,
    })),
  )

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /performance-goals/:goal_id/evaluations — 目標への評価を登録し、final なら目標を完了にする */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      kind: goalEvaluationKindSchema,
      score: z.number().safe().int().min(0).max(100).optional(),
      comment: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const goalId = validateIntParam(c.req.param("goal_id"), "goal")

    const json = c.req.valid("json")

    const createdAt = c.env.NOW ?? new Date().toISOString()

    const evaluation = await new CreateGoalEvaluation(c).run({
      goalId,
      kind: json.kind,
      score: json.score ?? null,
      comment: json.comment ?? null,
      evaluatorId: session.employeeId,
      session: session,
      createdAt,
    })

    if (evaluation instanceof ApplicationError) {
      throw toHttpException(evaluation)
    }

    const responseBody = zAppGoalEvaluation.parse({
      id: evaluation.id,
      goal_id: evaluation.goalId,
      evaluator_id: evaluation.evaluatorId,
      kind: evaluation.kind,
      score: evaluation.score,
      comment: evaluation.comment,
      created_at: evaluation.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
