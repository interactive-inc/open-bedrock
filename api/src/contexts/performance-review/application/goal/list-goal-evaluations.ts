import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { GetGoal } from "@/contexts/performance-review/application/goal/get-goal"
import type { GoalEvaluation } from "@/contexts/performance-review/domain/goal/goal-evaluation.entity"
import type { Context } from "@/env"
import { ApplicationError, UnexpectedError } from "@/lib/errors"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/goal/goal-evaluation-repository"

export type Command = {
  goalId: number
  viewerEmployeeId: number
  session: Session
}

/**
 * 目標に紐づく評価を登録順（id 昇順）で一覧する。
 * 目標の存在確認と閲覧権限判定は GetGoal に委譲し、目標詳細と同じ応答に揃える。
 */
export class ListGoalEvaluations {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<GoalEvaluation> | ApplicationError> {
    const goal = await new GetGoal(this.c).run(command)

    if (goal instanceof ApplicationError) {
      return goal
    }

    const repository = new GoalEvaluationRepository(this.c)

    const evaluations = await repository.findByGoalId(command.goalId)

    if (evaluations instanceof Error) {
      return new UnexpectedError("failed to load goal evaluations", { cause: evaluations })
    }

    return evaluations
  }
}
