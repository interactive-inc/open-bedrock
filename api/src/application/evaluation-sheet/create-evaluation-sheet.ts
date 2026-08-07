import { EvaluationSheet } from "@/domain/evaluation-sheet/evaluation-sheet.entity"
import type { Context } from "@/env"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/infrastructure/evaluation-sheet/evaluation-sheet-repository"
import { employees, orgMemberships } from "@/schema"
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
 * primary_evaluator_id が未指定の場合、org_memberships から directManager を解決する。
 */
export class CreateEvaluationSheet {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<EvaluationSheet | ApplicationError> {
    const repository = new EvaluationSheetRepository(this.c)

    // 対象社員の存在確認
    const employeeRows = await this.c.var.database
      .select({ id: employees.id, code: employees.code })
      .from(employees)
      .where(eq(employees.id, command.employeeId))
      .limit(1)

    const targetEmployee = employeeRows.at(0)

    if (targetEmployee === undefined) {
      return new ValidationError("employee not found", "employee_not_found")
    }

    // 同一社員・同一評価期に active なシートがないか確認
    const existingResult = await repository.findAll({
      employeeId: command.employeeId,
      period: command.period,
      limit: 1,
      offset: 0,
    })

    if (!(existingResult instanceof Error)) {
      const activeSheet = existingResult.data.find(
        (s) => s.status !== "finalized" && s.status !== "archived",
      )

      if (activeSheet !== undefined) {
        return new ConflictError(
          "an active evaluation sheet already exists for this employee and period",
          "duplicate_active_sheet",
        )
      }
    }

    let primaryEvaluatorId = command.primaryEvaluatorId ?? null
    const secondaryEvaluatorId = command.secondaryEvaluatorId ?? null

    // 一次評価者が未指定の場合、org_memberships から directManager を自動解決する
    if (primaryEvaluatorId === null) {
      if (targetEmployee.code === null) {
        return new ValidationError(
          "employee has no employee code; specify primary_evaluator_id explicitly",
          "no_employee_code",
        )
      }

      // 対象社員の上長コードを org_memberships から取得
      const membershipRows = await this.c.var.database
        .select({ managerEmployeeCode: orgMemberships.managerEmployeeCode })
        .from(orgMemberships)
        .where(eq(orgMemberships.employeeCode, targetEmployee.code))
        .limit(1)

      const membership = membershipRows.at(0)

      if (membership === undefined || membership.managerEmployeeCode === null) {
        return new ValidationError(
          "no direct manager found for the employee; specify primary_evaluator_id explicitly",
          "no_manager_found",
        )
      }

      // 上長コードから employee ID を解決
      const managerRows = await this.c.var.database
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.code, membership.managerEmployeeCode))
        .limit(1)

      const manager = managerRows.at(0)

      if (manager === undefined) {
        return new ValidationError(
          "manager employee code could not be resolved to an employee",
          "manager_not_found",
        )
      }

      primaryEvaluatorId = manager.id
    } else {
      // 明示指定された一次評価者の存在確認
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
    }

    // テンプレートの存在確認（指定時のみ）
    if (command.templateId !== null) {
      const { evaluationTemplates } = await import("@/schema")

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
      primaryEvaluatorId,
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
}
