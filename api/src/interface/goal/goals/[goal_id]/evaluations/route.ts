import { CreateGoalEvaluation } from "@/application/goal/create-goal-evaluation"
import { factory } from "@/lib/factory"
import { goalEvaluationKindSchema } from "@/domain/goal/goal-evaluation.entity"
import { ApplicationError } from "@/lib/errors"
import { zAppGoalEvaluation } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { z } from "zod"

// POST /goals/:goal_id/evaluations — 目標への評価を登録し、final なら目標を完了にする
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
