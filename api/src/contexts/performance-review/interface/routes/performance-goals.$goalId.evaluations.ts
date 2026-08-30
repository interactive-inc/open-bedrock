import { canReadGoalOf } from "@/contexts/performance-review/domain/policies/goal-read-access.policy"
import { ResolveEmployeeRelationAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-employee-relation.adapter"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"

import { UnexpectedError } from "@/lib/errors"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal-evaluation.repository"
import { CreateGoalEvaluation } from "@/contexts/performance-review/application/goal/create-goal-evaluation"
import { factory } from "@/api/http/factory"
import { goalEvaluationKindSchema } from "@/contexts/performance-review/domain/entities/goal-evaluation.entity"
import { ApplicationError } from "@/lib/errors"
import {
  zAppGoalEvaluation,
  zAppGoalEvaluationList,
} from "@/contexts/performance-review/interface/http/response-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/lib/http/errors"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** GET /performance-goals/:goalId/evaluations — 目標に紐づく評価の一覧（閲覧権限は GET /performance-goals/:goalId と同じ） */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const goalId = validateIntParam(c.req.param("goalId"), "goal")

  const evaluations = await (async () => {
    const command = {
      goalId,
      viewerEmployeeId: session.employeeId,
      session: session,
    }

    const goal = await (async () => {
      const goalCommand = command

      const repository = new GoalRepository(c)

      const goal = await repository.findById(goalCommand.goalId)

      if (goal instanceof Error) {
        return new UnexpectedError("failed to find goal", { cause: goal })
      }

      if (goal === null) {
        return new NotFoundError("goal not found", "goal_not_found")
      }

      const isOwner = goal.employeeId === goalCommand.viewerEmployeeId

      if (isOwner === false) {
        const relation = await new ResolveEmployeeRelationAdapter(c).resolveEmployeeRelation({
          viewerEmployeeId: goalCommand.viewerEmployeeId,
          targetEmployeeId: goal.employeeId,
        })

        if (relation instanceof Error) {
          return new UnexpectedError("failed to resolve employee relation", { cause: relation })
        }

        if (canReadGoalOf(goalCommand.session, relation) === false) {
          return new ForbiddenError("cannot view this goal", "not_viewable")
        }
      }

      return goal
    })()

    if (goal instanceof ApplicationError) {
      return goal
    }

    const repository = new GoalEvaluationRepository(c)

    const evaluations = await repository.findByGoalId(command.goalId)

    if (evaluations instanceof Error) {
      return new UnexpectedError("failed to load goal evaluations", { cause: evaluations })
    }

    return evaluations
  })()

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
/** POST /performance-goals/:goalId/evaluations — 目標への評価を登録し、final なら目標を完了にする */
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

    const goalId = validateIntParam(c.req.param("goalId"), "goal")

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
