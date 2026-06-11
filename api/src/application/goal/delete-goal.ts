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

    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare("DELETE FROM goal_evaluations WHERE goal_id = ?1").bind(
          command.goalId,
        ),
        this.c.env.DB.prepare("DELETE FROM goals WHERE id = ?1").bind(command.goalId),
      ])
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete goal")
    }

    return { reason: "deleted" }
  }
}
