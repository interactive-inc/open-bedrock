import { CreateGoalEvaluation } from "@/application/goal/create-goal-evaluation"
import { factory } from "@/lib/factory"
import { goalEvaluationKindSchema } from "@/domain/goal/goal-evaluation"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { z } from "zod"

// POST /goals/:goal_id/evaluations — 目標への評価を登録し、final なら目標を完了にする
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      kind: goalEvaluationKindSchema,
      score: z.number().optional(),
      comment: z.string().max(3_000).optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const goalId = Number(c.req.param("goal_id"))

    if (Number.isInteger(goalId) === false) {
      throw new BadRequestError("invalid goal id")
    }

    const json = c.req.valid("json")

    const createdAt = c.env.NOW ?? new Date().toISOString()

    const evaluation = await new CreateGoalEvaluation(c).run({
      goalId,
      kind: json.kind,
      score: json.score ?? null,
      comment: json.comment ?? null,
      evaluatorId: session.employeeId,
      viewerRole: session.role,
      createdAt,
    })

    if (evaluation instanceof Error) {
      throw new InternalError("failed to create evaluation")
    }

    if ("reason" in evaluation) {
      if (evaluation.reason === "goal_not_found") {
        throw new NotFoundError("goal not found")
      }

      if (evaluation.reason === "already_evaluated") {
        throw new ConflictError("already evaluated")
      }

      throw new ForbiddenError()
    }

    const responseBody = {
      id: evaluation.id,
      goal_id: evaluation.goalId,
      evaluator_id: evaluation.evaluatorId,
      kind: evaluation.kind,
      score: evaluation.score,
      comment: evaluation.comment,
      created_at: evaluation.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
