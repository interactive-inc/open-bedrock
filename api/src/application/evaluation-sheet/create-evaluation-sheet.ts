import { EvaluationSheet } from "@/domain/evaluation-sheet/evaluation-sheet.entity"
import type { Context } from "@/env"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/infrastructure/evaluation-sheet/evaluation-sheet-repository"
import { resolveDirectManagerId } from "@/lib/org/resolve-direct-manager-id"
import { employees, evaluationTemplates } from "@/schema"
import { eq } from "drizzle-orm"

export type Command = {
  employeeId: number
  templateId: number | null
  period: string
  /** HR/admin が明示指定する場合のみ。省略時は directManager を自動解決する。 */
  primaryEvaluatorId?: number
  secondaryEvaluatorId?: number | null
  /** 管理者（createdBy）の employeeId。directManager 自動解決用。 */
  creatorEmployeeId: number
  now: string
}

/**
 * 評価シートを作成する。
 * primary_evaluator_id が未指定の場合、resolveDirectManagerId で直属上長を解決する。
 *
 * company-optional tier: MBO 機能は会社単位のオプション。
 */
export class CreateEvaluationSheet {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<EvaluationSheet | ApplicationError> {
    const repository = new EvaluationSheetRepository(this.c)

    // 対象社員の存在確認
    const employeeRows = await this.c.var.database
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, command.employeeId))
      .limit(1)

    if (employeeRows.at(0) === undefined) {
      return new ValidationError("employee not found", "employee_not_found")
    }

    // 同一社員・同一評価期にシートがないか確認（完全一意制約）
    const existingResult = await repository.findAll({
      employeeId: command.employeeId,
      period: command.period,
      limit: 1,
      offset: 0,
    })

    if (!(existingResult instanceof Error) && existingResult.data.length > 0) {
      return new ConflictError(
        "an evaluation sheet already exists for this employee and period",
        "duplicate_sheet",
      )
    }

    // 一次評価者の解決
    const primaryEvaluatorId = command.primaryEvaluatorId ?? null

    if (primaryEvaluatorId !== null) {
      // 明示指定: 存在確認
      const evaluatorRows = await this.c.var.database
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, primaryEvaluatorId))
        .limit(1)

      if (evaluatorRows.at(0) === undefined) {
        return new ValidationError("primary evaluator not found", "primary_evaluator_not_found")
      }

      // 自分自身を一次評価者にしない
      if (primaryEvaluatorId === command.employeeId) {
        return new ValidationError(
          "primary evaluator cannot be the same as the evaluated employee",
          "self_evaluation_not_allowed",
        )
      }
    }

    // 一次評価者が未指定 → 直属上長を自動解決
    const resolvedPrimaryId =
      primaryEvaluatorId ?? (await this.resolveManagerOrError(command.employeeId))

    if (resolvedPrimaryId instanceof Error) {
      return resolvedPrimaryId
    }

    const secondaryEvaluatorId = command.secondaryEvaluatorId ?? null

    // 二次評価者の存在確認（指定時のみ）
    if (secondaryEvaluatorId !== null) {
      const secondaryRows = await this.c.var.database
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, secondaryEvaluatorId))
        .limit(1)

      if (secondaryRows.at(0) === undefined) {
        return new ValidationError("secondary evaluator not found", "secondary_evaluator_not_found")
      }

      // 二次評価者 ≠ 対象社員
      if (secondaryEvaluatorId === command.employeeId) {
        return new ValidationError(
          "secondary evaluator cannot be the same as the evaluated employee",
          "self_evaluation_not_allowed",
        )
      }

      // 二次評価者 ≠ 一次評価者
      if (secondaryEvaluatorId === resolvedPrimaryId) {
        return new ValidationError(
          "secondary evaluator cannot be the same as primary evaluator",
          "evaluator_conflict",
        )
      }
    }

    // テンプレートの存在確認（指定時のみ）
    if (command.templateId !== null) {
      const templateRows = await this.c.var.database
        .select({ id: evaluationTemplates.id })
        .from(evaluationTemplates)
        .where(eq(evaluationTemplates.id, command.templateId))
        .limit(1)

      if (templateRows.at(0) === undefined) {
        return new ValidationError("evaluation template not found", "template_not_found")
      }
    }

    const sheet = EvaluationSheet.create({
      employeeId: command.employeeId,
      templateId: command.templateId,
      period: command.period,
      primaryEvaluatorId: resolvedPrimaryId,
      secondaryEvaluatorId,
      now: command.now,
    })

    const created = await repository.create(sheet)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create evaluation sheet", { cause: created })
    }

    // 作成を監査ログに記録
    const auditResult = await repository.appendAuditLog({
      sheetId: created.id!,
      actorId: command.creatorEmployeeId,
      action: "created",
      fromValue: null,
      toValue: "draft",
      note: null,
      now: command.now,
    })

    if (auditResult instanceof Error) {
      // 監査ログの失敗はシート作成自体を巻き戻さない（ログ欠損として記録可能）
    }

    return created
  }

  /** 直属上長の employee ID を解決する。見つからなければ ValidationError を返す。 */
  private async resolveManagerOrError(
    targetEmployeeId: number,
  ): Promise<number | ApplicationError> {
    const managerId = await resolveDirectManagerId(this.c, targetEmployeeId)

    if (managerId instanceof Error) {
      return new UnexpectedError("failed to resolve direct manager", { cause: managerId })
    }

    if (managerId === null) {
      return new ValidationError(
        "no direct manager found for the employee; specify primary_evaluator_id explicitly",
        "no_manager_found",
      )
    }

    return managerId
  }
}
