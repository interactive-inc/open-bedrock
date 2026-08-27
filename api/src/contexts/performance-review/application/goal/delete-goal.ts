import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { hasFinalEvaluation } from "@/contexts/performance-review/domain/policies/final-goal-evaluation.policy"
import type { Context } from "@/env"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal-evaluation.repository"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"
import type { ApplicationError } from "@/lib/errors"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

export type Command = {
  goalId: number
  employeeId: EmployeeId
}

export type Deleted = { reason: "deleted" }

/**
 * 目標を削除する。本人以外の削除と、確定評価済みの目標の削除を拒否する。
 */
export class DeleteGoal {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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
    if (current.evaluationSheetId !== null && current.evaluationSheetId !== undefined) {
      const sheet = await repository.findEvaluationSheetState(current.evaluationSheetId)
      if (sheet instanceof Error) {
        return new UnexpectedError("failed to load evaluation sheet", { cause: sheet })
      }
      const EDITABLE_SHEET_STATUSES = ["draft", "rejected"]

      if (sheet !== null && EDITABLE_SHEET_STATUSES.includes(sheet.status) === false) {
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
    // goals の DELETE に status != 'done' + sheet status ガードを付け、
    // 確定済み目標の TOCTOU 競合およびシート提出と削除の競合を防ぐ。
    const now = this.c.env.NOW ?? new Date().toISOString()
    const deleted = await repository.deleteWithEvaluations(current, command.employeeId, now)
    if (deleted instanceof ConflictError) return deleted
    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete goal", { cause: deleted })
    }

    return { reason: "deleted" }
  }
}
