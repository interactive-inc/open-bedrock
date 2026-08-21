import type { EvaluationSheet } from "@/contexts/performance-review/domain/entities/evaluation-sheet.entity"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/contexts/performance-review/infrastructure/evaluation-sheet/evaluation-sheet.repository"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { inArray } from "drizzle-orm"

export type Command = {
  sheetId: number
  primaryEvaluatorId: number
  secondaryEvaluatorId: number | null
  expectedRevision: number
  actorEmployeeId: number
  now: string
}

/**
 * 評価者を変更する（HR/admin 専用）。
 * 評価者の存在確認・自己評価ガード・重複ガードを行い、
 * 監査ログに変更前後をアトミックに記録する。
 */
export class ChangeEvaluators {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<EvaluationSheet | ApplicationError> {
    const repository = new EvaluationSheetRepository(this.c)

    const existing = await repository.findById(command.sheetId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load evaluation sheet", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("evaluation sheet not found", "evaluation_sheet_not_found")
    }

    // 楽観的ロック
    if (existing.revision !== command.expectedRevision) {
      return new ConflictError(
        "evaluation sheet was modified by another request",
        "revision_conflict",
      )
    }

    // 一次評価者 ≠ 対象社員
    if (command.primaryEvaluatorId === existing.employeeId) {
      return new ValidationError(
        "primary evaluator cannot be the same as the evaluated employee",
        "self_evaluation_not_allowed",
      )
    }

    // 二次評価者 ≠ 対象社員
    if (
      command.secondaryEvaluatorId !== null &&
      command.secondaryEvaluatorId === existing.employeeId
    ) {
      return new ValidationError(
        "secondary evaluator cannot be the same as the evaluated employee",
        "self_evaluation_not_allowed",
      )
    }

    // 二次評価者 ≠ 一次評価者
    if (
      command.secondaryEvaluatorId !== null &&
      command.secondaryEvaluatorId === command.primaryEvaluatorId
    ) {
      return new ValidationError(
        "secondary evaluator cannot be the same as primary evaluator",
        "evaluator_conflict",
      )
    }

    // 評価者の存在確認
    const evaluatorIds = [command.primaryEvaluatorId]

    if (command.secondaryEvaluatorId !== null) {
      evaluatorIds.push(command.secondaryEvaluatorId)
    }

    const evaluatorRows = await this.c.var.database
      .select({ id: employees.id })
      .from(employees)
      .where(inArray(employees.id, evaluatorIds))

    const foundIds = new Set(evaluatorRows.map((r) => r.id))

    if (!foundIds.has(command.primaryEvaluatorId)) {
      return new ValidationError("primary evaluator not found", "primary_evaluator_not_found")
    }

    if (command.secondaryEvaluatorId !== null && !foundIds.has(command.secondaryEvaluatorId)) {
      return new ValidationError("secondary evaluator not found", "secondary_evaluator_not_found")
    }

    const updated = existing.withEvaluators({
      primaryEvaluatorId: command.primaryEvaluatorId,
      secondaryEvaluatorId: command.secondaryEvaluatorId,
      now: command.now,
    })

    // 変更前後を監査ログにアトミックに記録
    const fromValue = JSON.stringify({
      primary: existing.primaryEvaluatorId,
      secondary: existing.secondaryEvaluatorId,
    })

    const toValue = JSON.stringify({
      primary: command.primaryEvaluatorId,
      secondary: command.secondaryEvaluatorId,
    })

    const saved = await repository.updateWithAuditLog(updated, {
      actorId: command.actorEmployeeId,
      action: "evaluator_change",
      fromValue,
      toValue,
      note: null,
      now: command.now,
    })

    if (saved instanceof Error) {
      if (saved instanceof ConflictError) {
        return saved
      }

      return new UnexpectedError("failed to update evaluators", { cause: saved })
    }

    return saved
  }
}
