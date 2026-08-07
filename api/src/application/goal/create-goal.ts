import { eq, sum } from "drizzle-orm"
import type { GoalOwnerType } from "@/domain/goal/goal.entity"
import { Goal } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import type { ApplicationError } from "@/lib/errors"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import { evaluationSheets, goals } from "@/schema"

export type Command = {
  employeeId: number
  period: string
  title: string
  kpi: string | null
  weight: number
  ownerType?: GoalOwnerType
  parentGoalId?: number | null
  departmentCode?: string | null
  evaluationSheetId?: number | null
}

/**
 * 認証された本人に紐づく目標を新規作成する。
 *
 * evaluation_sheet_id が指定された場合、シートの存在・所有者・評価期・
 * 編集可能ステータス・weight 合計を検証する。
 * weight 合計チェックは INSERT に guard 条件を埋め込み、TOCTOU 競合を防止する。
 */
export class CreateGoal {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Goal | ApplicationError> {
    // evaluation_sheet_id が指定された場合、事前検証（親切なエラーメッセージ用）
    if (command.evaluationSheetId !== undefined && command.evaluationSheetId !== null) {
      const sheetRows = await this.c.var.database
        .select({
          id: evaluationSheets.id,
          employeeId: evaluationSheets.employeeId,
          period: evaluationSheets.period,
          status: evaluationSheets.status,
        })
        .from(evaluationSheets)
        .where(eq(evaluationSheets.id, command.evaluationSheetId))
        .limit(1)

      const sheet = sheetRows.at(0)

      if (sheet === undefined) {
        return new ValidationError(
          "evaluation sheet not found",
          "evaluation_sheet_not_found",
        )
      }

      if (sheet.employeeId !== command.employeeId) {
        return new ValidationError(
          "evaluation sheet does not belong to this employee",
          "evaluation_sheet_owner_mismatch",
        )
      }

      if (sheet.period !== command.period) {
        return new ValidationError(
          "goal period does not match evaluation sheet period",
          "period_mismatch",
        )
      }

      const EDITABLE_SHEET_STATUSES = ["draft", "rejected"]

      if (EDITABLE_SHEET_STATUSES.includes(sheet.status) === false) {
        return new ValidationError(
          "goals can only be added when evaluation sheet is in draft or rejected status",
          "sheet_not_editable",
        )
      }

      // weight 合計が 100% を超えないか事前検証（親切なエラーメッセージ用）
      const weightRows = await this.c.var.database
        .select({ total: sum(goals.weight) })
        .from(goals)
        .where(eq(goals.evaluationSheetId, command.evaluationSheetId))

      const currentTotal = Number(weightRows.at(0)?.total ?? 0)

      if (currentTotal + command.weight > 100) {
        return new ValidationError(
          `total weight would exceed 100% (current: ${currentTotal}%, adding: ${command.weight}%)`,
          "weight_exceeded",
        )
      }

      // Atomic INSERT: guard 条件（sheet status + period + owner + weight 合計）を
      // INSERT ... SELECT ... WHERE に埋め込み、TOCTOU 競合を防止する。
      // 事前検証をパスしても concurrent write で guard が失敗する場合は ConflictError を返す。
      return this.createGoalAtomic(command)
    }

    // evaluation_sheet_id 未指定: 通常の Drizzle INSERT
    const repository = new GoalRepository(this.c)

    const goal = Goal.create({
      employeeId: command.employeeId,
      period: command.period,
      title: command.title,
      kpi: command.kpi,
      weight: command.weight,
      ownerType: command.ownerType,
      parentGoalId: command.parentGoalId,
      departmentCode: command.departmentCode,
      evaluationSheetId: command.evaluationSheetId,
    })

    const created = await repository.create(goal)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create goal", { cause: created })
    }

    return created
  }

  /**
   * evaluation_sheet_id 付きの目標を atomic に作成する。
   * INSERT ... SELECT ... WHERE で sheet status・period・owner・weight 合計を
   * 同一ステートメントで検証し、abortWhenPreviousStatementChangedNoRows で
   * 0 行挿入（guard 失敗）を検出する。
   */
  private async createGoalAtomic(
    command: Command,
  ): Promise<Goal | ApplicationError> {
    try {
      const db = this.c.env.DB

      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO performance_goals
               (employee_id, period, title, kpi, weight, status, owner_type,
                parent_goal_id, department_code, evaluation_sheet_id)
             SELECT ?1, ?2, ?3, ?4, ?5, 'draft', ?6, ?7, ?8, ?9
             WHERE EXISTS (
               SELECT 1 FROM evaluation_sheets
               WHERE id = ?9
                 AND employee_id = ?1
                 AND period = ?2
                 AND status IN ('draft', 'rejected')
             )
             AND (
               SELECT COALESCE(SUM(weight), 0)
               FROM performance_goals
               WHERE evaluation_sheet_id = ?9
             ) + ?5 <= 100`,
          )
          .bind(
            command.employeeId,
            command.period,
            command.title,
            command.kpi,
            command.weight,
            command.ownerType ?? "individual",
            command.parentGoalId ?? null,
            command.departmentCode ?? null,
            command.evaluationSheetId,
          ),
        abortWhenPreviousStatementChangedNoRows(db),
        db.prepare(
          `SELECT id, employee_id, period, title, kpi, weight, status,
                  owner_type, parent_goal_id, department_code, evaluation_sheet_id
           FROM performance_goals WHERE id = last_insert_rowid()`,
        ),
      ])

      type GoalRow = {
        id: number
        employee_id: number
        period: string
        title: string
        kpi: string | null
        weight: number
        status: string
        owner_type: string
        parent_goal_id: number | null
        department_code: string | null
        evaluation_sheet_id: number | null
      }

      const row = (results[2] as D1Result<GoalRow>).results?.at(0)

      if (row === undefined) {
        return new UnexpectedError("failed to read back created goal")
      }

      return Goal.fromRow({
        id: row.id,
        employeeId: row.employee_id,
        period: row.period,
        title: row.title,
        kpi: row.kpi,
        weight: row.weight,
        status: row.status,
        ownerType: row.owner_type,
        parentGoalId: row.parent_goal_id,
        departmentCode: row.department_code,
        evaluationSheetId: row.evaluation_sheet_id,
      })
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError(
          "concurrent modification: sheet status, period, or weight constraint changed",
          "concurrent_conflict",
        )
      }

      return error instanceof Error
        ? new UnexpectedError("failed to create goal", { cause: error })
        : new UnexpectedError("failed to create goal")
    }
  }
}
