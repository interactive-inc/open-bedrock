import type { Goal } from "@/domain/goal/goal"
import type { Context } from "@/env"
import { hasFinalEvaluation } from "@/domain/goal/has-final-evaluation"
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

export type GoalNotFound = { reason: "goal_not_found" }

export type NotOwner = { reason: "not_owner" }

export type GoalFinalized = { reason: "goal_finalized" }

/**
 * 目標の定義を変更する。本人以外の変更と、確定評価済みの目標の変更を拒否する。
 */
export class UpdateGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Goal | GoalNotFound | NotOwner | GoalFinalized | Error> {
    const repository = new GoalRepository(this.c)

    const current = await repository.findById(command.goalId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "goal_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_owner" }
    }

    const evaluations = await new GoalEvaluationRepository(this.c).findByGoalId(command.goalId)

    if (evaluations instanceof Error) {
      return evaluations
    }

    if (hasFinalEvaluation(evaluations)) {
      return { reason: "goal_finalized" }
    }

    const updated = current.withDetails({
      period: command.period,
      title: command.title,
      kpi: command.kpi,
      weight: command.weight,
    })

    const saved = await repository.update(updated)

    if (saved instanceof Error) {
      return saved
    }

    if (saved === null) {
      return { reason: "goal_finalized" }
    }

    return saved
  }
}
