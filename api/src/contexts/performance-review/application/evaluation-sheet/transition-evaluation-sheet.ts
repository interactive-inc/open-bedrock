import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type {
  EvaluationSheet,
  EvaluationSheetStatus,
} from "@/contexts/performance-review/domain/entities/evaluation-sheet.entity"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/evaluation-sheet/evaluation-sheet.repository"

export type Command = {
  sheetId: number
  targetStatus: EvaluationSheetStatus
  actorEmployeeId: EmployeeId
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
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

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

    // 提出時は weight 条件を UPDATE に埋め込んでアトミックに検証する
    if (existing.status === "draft" && command.targetStatus === "pending_approval") {
      return this.submitAtomically(existing, transitioned, command)
    }

    // 通常の遷移: 状態更新と監査ログをアトミックに実行
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
   * draft → pending_approval を weight 条件付きでアトミックに実行する。
   * UPDATE の WHERE に revision（CAS） + 目標 count > 0 + weight 合計 = 100 を
   * 埋め込み、concurrent な目標削除による weight 不整合を防ぐ。
   */
  private async submitAtomically(
    existing: EvaluationSheet,
    transitioned: EvaluationSheet,
    command: Command,
  ): Promise<EvaluationSheet | ApplicationError> {
    const saved = await new EvaluationSheetRepository(this.c).submitWithAuditLog(
      existing,
      transitioned,
      {
        actorId: command.actorEmployeeId,
        note: command.note,
        now: command.now,
      },
    )
    if (saved instanceof ConflictError) return saved
    return saved instanceof Error
      ? new UnexpectedError("failed to submit evaluation sheet", { cause: saved })
      : saved
  }

  /**
   * 提出時の目標 weight 不変条件を検証する。
   * - 目標が 1 件以上存在すること
   * - weight 合計がちょうど 100% であること
   */
  private async validateSubmitWeights(sheetId: number): Promise<ApplicationError | null> {
    const total = await new EvaluationSheetRepository(this.c).totalGoalWeight(sheetId)
    if (total instanceof Error) {
      return new UnexpectedError("failed to load evaluation sheet goals", { cause: total })
    }

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
