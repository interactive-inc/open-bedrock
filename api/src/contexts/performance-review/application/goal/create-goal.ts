import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { GoalOwnerType } from "@/contexts/performance-review/domain/entities/goal.entity"
import { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import type { Context } from "@/env"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/repositories/goal/goal.repository"
import type { ApplicationError } from "@/lib/errors"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"

export type Command = {
  employeeId: EmployeeId
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
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Goal | ApplicationError> {
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

    // evaluation_sheet_id が指定された場合、事前検証（親切なエラーメッセージ用）
    if (command.evaluationSheetId !== undefined && command.evaluationSheetId !== null) {
      const sheet = await repository.findEvaluationSheetState(command.evaluationSheetId)

      if (sheet instanceof Error) {
        return new UnexpectedError("failed to load evaluation sheet", { cause: sheet })
      }
      if (sheet === null) {
        return new ValidationError("evaluation sheet not found", "evaluation_sheet_not_found")
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
      const currentTotal = await repository.totalWeightForEvaluationSheet(command.evaluationSheetId)
      if (currentTotal instanceof Error) {
        return new UnexpectedError("failed to load goal weights", { cause: currentTotal })
      }

      if (currentTotal + command.weight > 100) {
        return new ValidationError(
          `total weight would exceed 100% (current: ${currentTotal}%, adding: ${command.weight}%)`,
          "weight_exceeded",
        )
      }

      // Atomic INSERT: guard 条件（sheet status + period + owner + weight 合計）を
      // INSERT ... SELECT ... WHERE に埋め込み、TOCTOU 競合を防止する。
      // 事前検証をパスしても concurrent write で guard が失敗する場合は ConflictError を返す。
      const created = await repository.createForEvaluationSheet(
        goal,
        command.employeeId,
        this.c.env.NOW ?? new Date().toISOString(),
      )
      if (created instanceof ConflictError) return created
      return created instanceof Error
        ? new UnexpectedError("failed to create goal", { cause: created })
        : created
    }

    // evaluation_sheet_id 未指定: 通常の Drizzle INSERT
    const created = await repository.create(goal)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create goal", { cause: created })
    }

    return created
  }
}
