import { eq, sum } from "drizzle-orm"
import type {
  EvaluationSheet,
  EvaluationSheetStatus,
} from "@/domain/evaluation-sheet/evaluation-sheet.entity"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/infrastructure/evaluation-sheet/evaluation-sheet-repository"
import { goals } from "@/schema"

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
 *
 * draft → pending_approval（提出）時は目標が 1 件以上存在し、
 * weight 合計がちょうど 100% であることを検証する。
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

    // 提出時（draft → pending_approval）: 目標の weight 合計が 100% であることを検証
    if (existing.status === "draft" && command.targetStatus === "pending_approval") {
      const weightError = await this.validateSubmitWeights(command.sheetId)

      if (weightError !== null) {
        return weightError
      }
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

  /**
   * 提出時の目標 weight 不変条件を検証する。
   * - 目標が 1 件以上存在すること
   * - weight 合計がちょうど 100% であること
   */
  private async validateSubmitWeights(
    sheetId: number,
  ): Promise<ApplicationError | null> {
    const rows = await this.c.var.database
      .select({ total: sum(goals.weight) })
      .from(goals)
      .where(eq(goals.evaluationSheetId, sheetId))

    const total = Number(rows.at(0)?.total ?? 0)

    if (total === 0) {
      return new ValidationError(
        "cannot submit: no goals are linked to this evaluation sheet",
        "no_goals",
      )
    }

    if (total !== 100) {
      return new ValidationError(
        `cannot submit: total goal weight must be exactly 100% (current: ${total}%)`,
        "weight_not_100",
      )
    }

    return null
  }
}
