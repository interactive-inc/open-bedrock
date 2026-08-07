import { EvaluationSheet } from "@/domain/evaluation-sheet/evaluation-sheet.entity"
import type { Context } from "@/env"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/infrastructure/evaluation-sheet/evaluation-sheet-repository"
import {
  resolveDirectManagerId,
  resolveDepartmentManagerId,
} from "@/lib/org/resolve-direct-manager-id"
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
 * secondary_evaluator_id が未指定の場合、resolveDepartmentManagerId で部門長を解決する。
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
    const resolvedPrimaryId = await this.resolvePrimaryEvaluator(command)

    if (resolvedPrimaryId instanceof Error) {
      return resolvedPrimaryId
    }

    // 二次評価者の解決
    const resolvedSecondaryId = await this.resolveSecondaryEvaluator(command, resolvedPrimaryId)

    if (resolvedSecondaryId instanceof Error) {
      return resolvedSecondaryId
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
      secondaryEvaluatorId: resolvedSecondaryId,
      now: command.now,
    })

    // 作成と監査ログをアトミックに実行
    const created = await repository.createWithAuditLog(sheet, {
      actorId: command.creatorEmployeeId,
      action: "created",
      fromValue: null,
      toValue: "draft",
      note: null,
      now: command.now,
    })

    if (created instanceof Error) {
      return new UnexpectedError("failed to create evaluation sheet", { cause: created })
    }

    return created
  }

  /** 一次評価者を解決する。明示指定があればバリデーション後に返し、なければ自動解決する。 */
  private async resolvePrimaryEvaluator(command: Command): Promise<number | ApplicationError> {
    const explicitId = command.primaryEvaluatorId ?? null

    if (explicitId !== null) {
      // 明示指定: 存在確認
      const evaluatorRows = await this.c.var.database
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, explicitId))
        .limit(1)

      if (evaluatorRows.at(0) === undefined) {
        return new ValidationError("primary evaluator not found", "primary_evaluator_not_found")
      }

      // 自分自身を一次評価者にしない
      if (explicitId === command.employeeId) {
        return new ValidationError(
          "primary evaluator cannot be the same as the evaluated employee",
          "self_evaluation_not_allowed",
        )
      }

      return explicitId
    }

    // 未指定 → 直属上長を自動解決
    const managerId = await resolveDirectManagerId(this.c, command.employeeId)

    if (managerId instanceof Error) {
      return new UnexpectedError("failed to resolve direct manager", { cause: managerId })
    }

    if (managerId === null) {
      return new ValidationError(
        "no direct manager found for the employee; specify primary_evaluator_id explicitly",
        "no_manager_found",
      )
    }

    // 自動解決された上長が本人と同一（循環データ）の場合
    if (managerId === command.employeeId) {
      return new ValidationError(
        "auto-resolved manager is the same as the employee; specify primary_evaluator_id explicitly",
        "circular_manager",
      )
    }

    return managerId
  }

  /**
   * 二次評価者を解決する。
   * 明示指定があればバリデーション後に返す。
   * 未指定の場合は部門長を自動解決する（解決失敗時は null）。
   */
  private async resolveSecondaryEvaluator(
    command: Command,
    primaryEvaluatorId: number,
  ): Promise<number | null | ApplicationError> {
    const explicitId = command.secondaryEvaluatorId ?? null

    if (explicitId !== null) {
      // 明示指定: 存在確認
      const secondaryRows = await this.c.var.database
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, explicitId))
        .limit(1)

      if (secondaryRows.at(0) === undefined) {
        return new ValidationError("secondary evaluator not found", "secondary_evaluator_not_found")
      }

      // 二次評価者 ≠ 対象社員
      if (explicitId === command.employeeId) {
        return new ValidationError(
          "secondary evaluator cannot be the same as the evaluated employee",
          "self_evaluation_not_allowed",
        )
      }

      // 二次評価者 ≠ 一次評価者
      if (explicitId === primaryEvaluatorId) {
        return new ValidationError(
          "secondary evaluator cannot be the same as primary evaluator",
          "evaluator_conflict",
        )
      }

      return explicitId
    }

    // 未指定 → 部門長を自動解決（ベストエフォート、失敗時は null）
    const deptManagerId = await resolveDepartmentManagerId(this.c, command.employeeId)

    if (deptManagerId instanceof Error || deptManagerId === null) {
      return null
    }

    // 部門長が本人 or 一次評価者と同一なら設定しない
    if (deptManagerId === command.employeeId || deptManagerId === primaryEvaluatorId) {
      return null
    }

    return deptManagerId
  }
}
