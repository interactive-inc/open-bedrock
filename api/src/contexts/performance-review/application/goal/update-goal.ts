import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { hasFinalEvaluation } from "@/contexts/performance-review/domain/policies/final-goal-evaluation.policy"
import type { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import type { Context } from "@/env"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal-evaluation.repository"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"
import type { ApplicationError } from "@/lib/errors"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"

export type Command = {
  goalId: number
  employeeId: EmployeeId
  period: string
  title: string
  kpi: string | null
  weight: number
}

/**
 * 目標の定義を変更する。本人以外の変更と、確定評価済みの目標の変更を拒否する。
 *
 * 評価シートに紐づく場合:
 * - シートが draft/rejected 以外なら拒否
 * - 更新後の period がシートの period と一致しなければ拒否
 * - 自分以外の目標の weight 合計 + 更新後 weight が 100 を超えたら拒否
 * - UPDATE 文に guard 条件を埋め込み TOCTOU 競合を防止
 */
export class UpdateGoal {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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

    // 評価シートに紐づく場合の検証
    if (current.evaluationSheetId !== null && current.evaluationSheetId !== undefined) {
      const sheet = await repository.findEvaluationSheetState(current.evaluationSheetId)
      if (sheet instanceof Error) {
        return new UnexpectedError("failed to load evaluation sheet", { cause: sheet })
      }
      const EDITABLE_SHEET_STATUSES = ["draft", "rejected"]

      if (sheet !== null && EDITABLE_SHEET_STATUSES.includes(sheet.status) === false) {
        return new ConflictError(
          "goals can only be modified when evaluation sheet is in draft or rejected status",
          "sheet_not_editable",
        )
      }

      // period 一致チェック
      if (sheet !== null && sheet.period !== command.period) {
        return new ValidationError(
          "goal period does not match evaluation sheet period",
          "period_mismatch",
        )
      }
    }

    const evaluations = await new GoalEvaluationRepository(this.c).findByGoalId(command.goalId)

    if (evaluations instanceof Error) {
      return new UnexpectedError("failed to find goal evaluations", {
        cause: evaluations,
      })
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

    // 評価シートに紐づく場合は atomic UPDATE（weight + status guard 付き）
    if (current.evaluationSheetId !== null && current.evaluationSheetId !== undefined) {
      const saved = await repository.updateForEvaluationSheet(
        updated,
        current,
        command.employeeId,
        this.c.env.NOW ?? new Date().toISOString(),
      )
      if (saved instanceof ConflictError) return saved
      return saved instanceof Error
        ? new UnexpectedError("failed to update goal", { cause: saved })
        : saved
    }

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
