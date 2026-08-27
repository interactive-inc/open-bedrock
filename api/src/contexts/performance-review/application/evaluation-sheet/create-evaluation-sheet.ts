import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { EvaluationSheet } from "@/contexts/performance-review/domain/entities/evaluation-sheet.entity"
import type { Context } from "@/env"
import { EvaluationSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/evaluation-sheet/evaluation-sheet.repository"
import type { ApplicationError } from "@/lib/errors"
import { ConflictError, UnexpectedError, ValidationError } from "@/lib/errors"
import { ResolveDirectManagerIdAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-direct-manager-id.adapter"
import { ResolveDepartmentManagerIdAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-department-manager-id.adapter"
import { ValidateEmployeeActiveAdapter } from "@/contexts/company/infrastructure/adapters/organization/validate-employee-active.adapter"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"
import { EvaluationParticipantAdapter } from "@/contexts/performance-review/infrastructure/adapters/evaluation-sheet/evaluation-participant.adapter"

export type Command = {
  employeeId: EmployeeId
  templateId: number | null
  period: string
  /** HR/admin が明示指定する場合のみ。省略時は directManager を自動解決する。 */
  primaryEvaluatorId?: EmployeeId
  secondaryEvaluatorId?: EmployeeId | null
  /** 管理者（createdBy）の employeeId。directManager 自動解決用。 */
  creatorEmployeeId: EmployeeId
  now: string
}

/**
 * 評価シートを作成する。
 * primary_evaluator_id が未指定の場合、resolveDirectManagerId で直属上長を解決する。
 * secondary_evaluator_id が未指定の場合、resolveDepartmentManagerId で部門長を解決する。
 *
 * app-opt-in tier: MBO 機能は会社単位のオプション。
 */
export class CreateEvaluationSheet {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<EvaluationSheet | ApplicationError> {
    const repository = new EvaluationSheetRepository(this.c)

    // 会社営業日を解決（タイムゾーン変換）。評価者自動解決の基準日に使用する。
    const businessDate = resolveCompanyBusinessDate({
      now: command.now,
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })

    if (typeof businessDate !== "string") {
      return new UnexpectedError("company time zone is unavailable", {
        cause: businessDate,
      })
    }

    // 対象社員の存在確認
    const employeeIds = await new EvaluationParticipantAdapter(this.c).existingEmployeeIds([
      command.employeeId,
    ])
    if (employeeIds instanceof Error) {
      return new UnexpectedError("failed to load employee", { cause: employeeIds })
    }
    if (!employeeIds.has(command.employeeId)) {
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
    const resolvedPrimaryId = await this.resolvePrimaryEvaluator(command, businessDate)

    if (resolvedPrimaryId instanceof Error) {
      return resolvedPrimaryId
    }

    // 解決された一次評価者の active/leave 状態を検証
    const primaryActiveError = await this.validateEvaluatorActive(
      resolvedPrimaryId,
      "primary",
      businessDate,
    )

    if (primaryActiveError !== null) {
      return primaryActiveError
    }

    // 二次評価者の解決
    const resolvedSecondaryId = await this.resolveSecondaryEvaluator(
      command,
      resolvedPrimaryId,
      businessDate,
    )

    if (resolvedSecondaryId instanceof Error) {
      return resolvedSecondaryId
    }

    // 解決された二次評価者の active/leave 状態を検証
    if (resolvedSecondaryId !== null) {
      const secondaryActiveError = await this.validateEvaluatorActive(
        resolvedSecondaryId,
        "secondary",
        businessDate,
      )

      if (secondaryActiveError !== null) {
        return secondaryActiveError
      }
    }

    // テンプレートの存在確認（指定時のみ）
    if (command.templateId !== null) {
      const templateExists = await new EvaluationParticipantAdapter(
        this.c,
      ).evaluationTemplateExists(command.templateId)
      if (templateExists instanceof Error) {
        return new UnexpectedError("failed to load evaluation template", {
          cause: templateExists,
        })
      }
      if (!templateExists) {
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
      return new UnexpectedError("failed to create evaluation sheet", {
        cause: created,
      })
    }

    return created
  }

  /**
   * 評価者が active または leave 状態であることを検証する。
   * archived 済みまたは retired の従業員を評価者に設定させない。
   *
   * 判定ロジックは lib/org/validate-employee-active.ts に共通化されており、
   * resolve-workflow-approver-matches.ts と同じ判定基準を共有する。
   */
  private async validateEvaluatorActive(
    evaluatorId: EmployeeId,
    role: "primary" | "secondary",
    businessDate: string,
  ): Promise<ApplicationError | null> {
    const result = await new ValidateEmployeeActiveAdapter(this.c).validateEmployeeActive(
      evaluatorId,
      businessDate,
    )

    if (result instanceof Error) {
      return new UnexpectedError(`failed to validate ${role} evaluator active status`, {
        cause: result,
      })
    }

    if (!result.valid) {
      const errorCodeMap: Record<string, string> = {
        not_found: `${role}_evaluator_not_found`,
        archived: "evaluator_archived",
        not_active: "evaluator_not_active",
        retired: "evaluator_retired",
        department_archived: "evaluator_department_archived",
      }

      return new ValidationError(
        `${role} evaluator: ${result.message}`,
        errorCodeMap[result.code] ?? result.code,
      )
    }

    return null
  }

  /** 一次評価者を解決する。明示指定があればバリデーション後に返し、なければ自動解決する。 */
  private async resolvePrimaryEvaluator(
    command: Command,
    businessDate: string,
  ): Promise<EmployeeId | ApplicationError> {
    const explicitId = command.primaryEvaluatorId ?? null

    if (explicitId !== null) {
      // 明示指定: 存在確認
      const evaluatorIds = await new EvaluationParticipantAdapter(this.c).existingEmployeeIds([
        explicitId,
      ])
      if (evaluatorIds instanceof Error) {
        return new UnexpectedError("failed to load primary evaluator", { cause: evaluatorIds })
      }
      if (!evaluatorIds.has(explicitId)) {
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

    // 未指定 → 直属上長を自動解決（基準日 = 会社営業日）
    const managerId = await new ResolveDirectManagerIdAdapter(this.c).resolveDirectManagerId(
      command.employeeId,
      businessDate,
    )

    if (managerId instanceof Error) {
      return new UnexpectedError("failed to resolve direct manager", {
        cause: managerId,
      })
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
    primaryEvaluatorId: EmployeeId,
    businessDate: string,
  ): Promise<EmployeeId | null | ApplicationError> {
    const explicitId = command.secondaryEvaluatorId ?? null

    if (explicitId !== null) {
      // 明示指定: 存在確認
      const evaluatorIds = await new EvaluationParticipantAdapter(this.c).existingEmployeeIds([
        explicitId,
      ])
      if (evaluatorIds instanceof Error) {
        return new UnexpectedError("failed to load secondary evaluator", { cause: evaluatorIds })
      }
      if (!evaluatorIds.has(explicitId)) {
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
    const deptManagerId = await new ResolveDepartmentManagerIdAdapter(
      this.c,
    ).resolveDepartmentManagerId(command.employeeId, businessDate)

    if (deptManagerId instanceof Error) {
      return new UnexpectedError("failed to resolve department manager", {
        cause: deptManagerId,
      })
    }

    if (deptManagerId === null) {
      return null
    }

    // 部門長が本人 or 一次評価者と同一なら設定しない
    if (deptManagerId === command.employeeId || deptManagerId === primaryEvaluatorId) {
      return null
    }

    return deptManagerId
  }
}
