import type {
  EvaluationSheet,
  EvaluationSheetStatus,
} from "@/domain/evaluation-sheet/evaluation-sheet.entity"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/infrastructure/evaluation-sheet/evaluation-sheet-repository"

export type Command = {
  sheetId: number
  targetStatus: EvaluationSheetStatus
  actorEmployeeId: number
  note: string | null
  now: string
}

/**
 * 評価シートのステータスを遷移させる。
 * ステータス遷移表に照らして不正な遷移を拒否し、監査ログを記録する。
 */
export class TransitionEvaluationSheet {
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

    const transitioned = existing.transition(command.targetStatus, command.now)

    if (transitioned === null) {
      return new ConflictError(
        `cannot transition from ${existing.status} to ${command.targetStatus}`,
        "invalid_status_transition",
      )
    }

    const saved = await repository.update(transitioned)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update evaluation sheet", { cause: saved })
    }

    if (saved === null) {
      return new NotFoundError("evaluation sheet not found", "evaluation_sheet_not_found")
    }

    // 監査ログを記録
    const auditResult = await repository.appendAuditLog({
      sheetId: command.sheetId,
      actorId: command.actorEmployeeId,
      action: "status_change",
      fromValue: existing.status,
      toValue: command.targetStatus,
      note: command.note,
      now: command.now,
    })

    if (auditResult instanceof Error) {
      // 監査ログの失敗はステータス遷移自体を巻き戻さない
    }

    return saved
  }
}
