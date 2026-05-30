import type { Forbidden } from "@/domain/goal/goal-access"
import { GoalEvaluation, type GoalEvaluationKind } from "@/domain/goal/goal-evaluation"
import { resolveEvaluationPermission } from "@/domain/goal/resolve-evaluation-permission"
import type { Context } from "@/env"
import { GoalEvaluationRepository } from "@/infrastructure/goal/goal-evaluation-repository"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  kind: GoalEvaluationKind
  score: number | null
  comment: string | null
  evaluatorId: number
  viewerRole: string
  createdAt: string
}

export type GoalNotFound = { reason: "goal_not_found" }

/**
 * 目標の存在確認・権限判定・評価作成・final時の完了反映までを束ねる。
 */
export class CreateGoalEvaluation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<GoalEvaluation | GoalNotFound | Forbidden | Error> {
    const goalRepository = new GoalRepository(this.c)

    const goalEvaluationRepository = new GoalEvaluationRepository(this.c)

    const goal = await goalRepository.findById(command.goalId)

    if (goal instanceof Error) {
      return goal
    }

    if (goal === null) {
      return { reason: "goal_not_found" }
    }

    const permission = resolveEvaluationPermission({
      kind: command.kind,
      goalEmployeeId: goal.employeeId,
      viewerEmployeeId: command.evaluatorId,
      viewerRole: command.viewerRole,
    })

    if (permission !== null) {
      return permission
    }

    const evaluation = await goalEvaluationRepository.create(
      GoalEvaluation.create({
        goalId: command.goalId,
        evaluatorId: command.evaluatorId,
        kind: command.kind,
        score: command.score,
        comment: command.comment,
        createdAt: command.createdAt,
      }),
    )

    if (evaluation instanceof Error) {
      return evaluation
    }

    if (command.kind === "final") {
      const updated = await goalRepository.update(goal.withStatus("done"))

      if (updated instanceof Error) {
        return updated
      }
    }

    return evaluation
  }
}
