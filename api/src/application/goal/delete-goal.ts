import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import { hasFinalEvaluation } from "@/lib/goal/has-final-evaluation"
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

    // goal_evaluations と goals を D1 batch でアトミックに削除する。
    // goals の DELETE に status != 'done' ガードを付け、確定済み目標の TOCTOU 競合を防ぐ。
    try {
      const db = this.c.env.DB
      await db.batch([
        db.prepare("DELETE FROM goal_evaluations WHERE goal_id = ?1").bind(command.goalId),
        db.prepare("DELETE FROM goals WHERE id = ?1 AND status != 'done'").bind(command.goalId),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return { reason: "goal_finalized" }
      }
      return error instanceof Error
        ? new UnexpectedError("failed to delete goal", { cause: error })
        : new UnexpectedError("failed to delete goal")
    }

    return { reason: "deleted" }
  }
}

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}

function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
