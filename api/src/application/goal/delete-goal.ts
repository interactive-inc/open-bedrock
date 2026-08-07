import { eq } from "drizzle-orm"
import { hasFinalEvaluation } from "@/application/goal/has-final-evaluation"
import type { Context } from "@/env"
import { GoalEvaluationRepository } from "@/infrastructure/goal/goal-evaluation-repository"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import type { ApplicationError } from "@/lib/errors"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"
import { evaluationSheets } from "@/schema"

export type Command = {
  goalId: number
  employeeId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 目標を削除する。本人以外の削除と、確定評価済みの目標の削除を拒否する。
 */
export class DeleteGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
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

    // 評価シートに紐づく場合、シートが編集可能ステータスか確認
    if (
      current.evaluationSheetId !== null &&
      current.evaluationSheetId !== undefined
    ) {
      const sheetRows = await this.c.var.database
        .select({ status: evaluationSheets.status })
        .from(evaluationSheets)
        .where(eq(evaluationSheets.id, current.evaluationSheetId))
        .limit(1)

      const sheet = sheetRows.at(0)
      const EDITABLE_SHEET_STATUSES = ["draft", "rejected"]

      if (
        sheet !== undefined &&
        EDITABLE_SHEET_STATUSES.includes(sheet.status) === false
      ) {
        return new ConflictError(
          "goals can only be deleted when evaluation sheet is in draft or rejected status",
          "sheet_not_editable",
        )
      }
    }

    const evalRepo = new GoalEvaluationRepository(this.c)

    const evaluations = await evalRepo.findByGoalId(command.goalId)

    if (evaluations instanceof Error) {
      return new UnexpectedError("failed to find goal evaluations", {
        cause: evaluations,
      })
    }

    if (hasFinalEvaluation(evaluations)) {
      return new ConflictError("goal is already finalized", "goal_finalized")
    }

    // goal_evaluations と goals を D1 batch でアトミックに削除する。
    // goals の DELETE に status != 'done' ガードを付け、確定済み目標の TOCTOU 競合を防ぐ。
    try {
      const db = this.c.env.DB
      await db.batch([
        db
          .prepare("DELETE FROM goal_evaluations WHERE goal_id = ?1")
          .bind(command.goalId),
        db
          .prepare(
            "DELETE FROM performance_goals WHERE id = ?1 AND status != 'done'",
          )
          .bind(command.goalId),
        abortWhenPreviousStatementChangedNoRows(db),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError("goal is already finalized", "goal_finalized")
      }

      return new UnexpectedError("failed to delete goal", { cause: error })
    }

    return { reason: "deleted" }
  }
}
