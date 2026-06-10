import type { Context } from "@/env"
import { hasFinalEvaluation } from "@/domain/goal/has-final-evaluation"
import { GoalEvaluationRepository } from "@/infrastructure/goal/goal-evaluation-repository"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  employeeId: number
}

export type GoalNotFound = { reason: "goal_not_found" }

export type NotOwner = { reason: "not_owner" }

export type GoalFinalized = { reason: "goal_finalized" }

export type Deleted = { reason: "deleted" }

/**
 * 目標を削除する。本人以外の削除と、確定評価済みの目標の削除を拒否する。
 */
export class DeleteGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | GoalNotFound | NotOwner | GoalFinalized | Error> {
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

    const evalRepo = new GoalEvaluationRepository(this.c)

    const evaluations = await evalRepo.findByGoalId(command.goalId)

    if (evaluations instanceof Error) {
      return evaluations
    }

    if (hasFinalEvaluation(evaluations)) {
      return { reason: "goal_finalized" }
    }

    const deletedEvals = await evalRepo.deleteByGoalId(command.goalId)

    if (deletedEvals instanceof Error) {
      return deletedEvals
    }

    const deleted = await repository.delete(command.goalId)

    if (deleted instanceof Error) {
      return deleted
    }

    return { reason: "deleted" }
  }
}
