import type { EvaluationSheet } from "@/domain/evaluation-sheet/evaluation-sheet.entity"
import type { Context } from "@/env"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/infrastructure/evaluation-sheet/evaluation-sheet-repository"

export type Command = {
  sheetId: number
  primaryEvaluatorId: number
  secondaryEvaluatorId: number | null
  actorEmployeeId: number
  now: string
}

/**
 * 評価者を変更する（HR/admin 専用）。
 * 監査ログに変更前後を記録する。
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

    const updated = existing.withEvaluators({
      primaryEvaluatorId: command.primaryEvaluatorId,
      secondaryEvaluatorId: command.secondaryEvaluatorId,
      now: command.now,
    })

    const saved = await repository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update evaluators", { cause: saved })
    }

    if (saved === null) {
      return new NotFoundError("evaluation sheet not found", "evaluation_sheet_not_found")
    }

    // 変更前後を監査ログに記録
    const fromValue = JSON.stringify({
      primary: existing.primaryEvaluatorId,
      secondary: existing.secondaryEvaluatorId,
    })

    const toValue = JSON.stringify({
      primary: command.primaryEvaluatorId,
      secondary: command.secondaryEvaluatorId,
    })

    const auditResult = await repository.appendAuditLog({
      sheetId: command.sheetId,
      actorId: command.actorEmployeeId,
      action: "evaluator_change",
      fromValue,
      toValue,
      note: null,
      now: command.now,
    })

    if (auditResult instanceof Error) {
      // 監査ログの失敗は変更自体を巻き戻さない
    }

    return saved
  }
}
