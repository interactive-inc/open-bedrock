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
  expectedRevision: number
  note: string | null
  now: string
}

/**
 * 評価シートのステータスを遷移させる。
 * ステータス遷移表に照らして不正な遷移を拒否し、楽観的ロック（revision）で
 * 同時更新を検出し、状態更新と監査ログを D1 batch でアトミックに記録する。
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

    // 楽観的ロック: クライアントが認識している revision と一致するか確認
    if (existing.revision !== command.expectedRevision) {
      return new ConflictError(
        "evaluation sheet was modified by another request",
        "revision_conflict",
      )
    }

    const transitioned = existing.transition(command.targetStatus, command.now)

    if (transitioned === null) {
      return new ConflictError(
        `cannot transition from ${existing.status} to ${command.targetStatus}`,
        "invalid_status_transition",
      )
    }

    // 状態更新と監査ログをアトミックに実行
    const saved = await repository.updateWithAuditLog(transitioned, {
      actorId: command.actorEmployeeId,
      action: "status_change",
      fromValue: existing.status,
      toValue: command.targetStatus,
      note: command.note,
      now: command.now,
    })

    if (saved instanceof Error) {
      if (saved instanceof ConflictError) {
        return saved
      }

      return new UnexpectedError("failed to update evaluation sheet", { cause: saved })
    }

    return saved
  }
}
