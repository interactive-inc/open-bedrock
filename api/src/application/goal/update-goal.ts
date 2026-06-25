import type { Goal } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { hasFinalEvaluation } from "@/lib/goal/has-final-evaluation"
import { GoalEvaluationRepository } from "@/infrastructure/goal/goal-evaluation-repository"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  employeeId: number
  period: string
  title: string
  kpi: string | null
  weight: number
}

/**
 * 目標の定義を変更する。本人以外の変更と、確定評価済みの目標の変更を拒否する。
 */
export class UpdateGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Goal | ApplicationError> {
    const repository = new GoalRepository(this.c)

    const current = await repository.findById(command.goalId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find goal", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("goal not found", "goal_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the goal owner", "not_owner")
    }

    const evaluations = await new GoalEvaluationRepository(this.c).findByGoalId(command.goalId)

    if (evaluations instanceof Error) {
      return new UnexpectedError("failed to find goal evaluations", { cause: evaluations })
    }

    if (hasFinalEvaluation(evaluations)) {
      return new ConflictError("goal is already finalized", "goal_finalized")
    }

    const updated = current.withDetails({
      period: command.period,
      title: command.title,
      kpi: command.kpi,
      weight: command.weight,
    })

    const saved = await repository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update goal", { cause: saved })
    }

    if (saved === null) {
      return new ConflictError("goal is already finalized", "goal_finalized")
    }

    return saved
  }
}
