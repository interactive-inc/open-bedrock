import { eq } from "drizzle-orm"
import { hasFinalEvaluation } from "@/contexts/performance-review/domain/policies/final-goal-evaluation.policy"
import type { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import type { Context } from "@/env"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/goal/goal-evaluation.repository"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/goal/goal.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import type { ApplicationError } from "@/lib/errors"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "@/lib/errors"
import { evaluationSheets } from "@/contexts/performance-review/infrastructure/schema/performance-review"

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
 *
 * 評価シートに紐づく場合:
 * - シートが draft/rejected 以外なら拒否
 * - 更新後の period がシートの period と一致しなければ拒否
 * - 自分以外の目標の weight 合計 + 更新後 weight が 100 を超えたら拒否
 * - UPDATE 文に guard 条件を埋め込み TOCTOU 競合を防止
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

    // 評価シートに紐づく場合の検証
    if (current.evaluationSheetId !== null && current.evaluationSheetId !== undefined) {
      const sheetRows = await this.c.var.database
        .select({
          status: evaluationSheets.status,
          period: evaluationSheets.period,
        })
        .from(evaluationSheets)
        .where(eq(evaluationSheets.id, current.evaluationSheetId))
        .limit(1)

      const sheet = sheetRows.at(0)
      const EDITABLE_SHEET_STATUSES = ["draft", "rejected"]

      if (sheet !== undefined && EDITABLE_SHEET_STATUSES.includes(sheet.status) === false) {
        return new ConflictError(
          "goals can only be modified when evaluation sheet is in draft or rejected status",
          "sheet_not_editable",
        )
      }

      // period 一致チェック
      if (sheet !== undefined && sheet.period !== command.period) {
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
      return this.updateGoalAtomic(updated, current, current.evaluationSheetId, command)
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

  /**
   * 評価シート付き目標の atomic UPDATE。
   * weight 合計（自分以外）+ 新 weight <= 100、sheet status IN ('draft', 'rejected')、
   * period 一致を UPDATE 文の WHERE に埋め込む。
   */
  private async updateGoalAtomic(
    goal: Goal,
    previous: Goal,
    sheetId: number,
    command: Command,
  ): Promise<Goal | ApplicationError> {
    try {
      const db = this.c.env.DB
      const now = this.c.env.NOW ?? new Date().toISOString()

      await db.batch([
        db
          .prepare(
            `UPDATE performance_goals
             SET period = ?1, title = ?2, kpi = ?3, weight = ?4
             WHERE id = ?5
               AND status != 'done'
               AND evaluation_sheet_id = ?6
               AND EXISTS (
                 SELECT 1 FROM evaluation_sheets
                 WHERE id = ?6
                   AND status IN ('draft', 'rejected')
                   AND period = ?1
               )
               AND (
                 SELECT COALESCE(SUM(pg.weight), 0)
                 FROM performance_goals pg
                 WHERE pg.evaluation_sheet_id = ?6 AND pg.id != ?5
               ) + ?4 <= 100`,
          )
          .bind(
            command.period,
            command.title,
            command.kpi,
            command.weight,
            command.goalId,
            sheetId,
          ),
        abortWhenPreviousStatementChangedNoRows(db),
        // 評価シートの監査ログをアトミックに記録
        db
          .prepare(
            `INSERT INTO evaluation_sheet_audit_logs
               (sheet_id, actor_id, action, from_value, to_value, note, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          )
          .bind(
            sheetId,
            command.employeeId,
            "goal_update",
            JSON.stringify({
              goal_id: command.goalId,
              title: previous.title,
              weight: previous.weight,
              period: previous.period,
              kpi: previous.kpi,
            }),
            JSON.stringify({
              goal_id: command.goalId,
              title: command.title,
              weight: command.weight,
              period: command.period,
              kpi: command.kpi,
            }),
            null,
            now,
          ),
      ])

      // re-fetch the updated goal
      const repository = new GoalRepository(this.c)
      const saved = await repository.findById(command.goalId)

      if (saved instanceof Error || saved === null) {
        return new UnexpectedError("failed to read back updated goal")
      }

      return saved
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError(
          "concurrent modification: sheet status, period, or weight constraint changed",
          "concurrent_conflict",
        )
      }

      return error instanceof Error
        ? new UnexpectedError("failed to update goal", { cause: error })
        : new UnexpectedError("failed to update goal")
    }
  }
}
