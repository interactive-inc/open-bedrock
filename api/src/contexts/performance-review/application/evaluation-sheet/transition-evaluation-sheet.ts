import { eq, sum } from "drizzle-orm"
import type {
  EvaluationSheet,
  EvaluationSheetStatus,
} from "@/contexts/performance-review/domain/entities/evaluation-sheet.entity"
import type { Context } from "@/env"
import { ConflictError, NotFoundError, UnexpectedError, ValidationError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { EvaluationSheetRepository } from "@/contexts/performance-review/infrastructure/evaluation-sheet/evaluation-sheet.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"

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
    try {
      const db = this.c.env.DB

      await db.batch([
        db
          .prepare(
            `UPDATE evaluation_sheets
             SET status = ?1, primary_evaluator_id = ?2, secondary_evaluator_id = ?3,
                 submitted_at = ?4, approved_at = ?5, finalized_at = ?6,
                 revision = ?7, updated_at = ?8
             WHERE id = ?9 AND revision = ?10
               AND (SELECT COUNT(*) FROM performance_goals WHERE evaluation_sheet_id = ?9) > 0
               AND (SELECT COALESCE(SUM(weight), 0) FROM performance_goals WHERE evaluation_sheet_id = ?9) = 100`,
          )
          .bind(
            transitioned.status,
            transitioned.primaryEvaluatorId,
            transitioned.secondaryEvaluatorId,
            transitioned.submittedAt,
            transitioned.approvedAt,
            transitioned.finalizedAt,
            transitioned.revision,
            transitioned.updatedAt,
            transitioned.id,
            existing.revision,
          ),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            `INSERT INTO evaluation_sheet_audit_logs
               (sheet_id, actor_id, action, from_value, to_value, note, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          )
          .bind(
            transitioned.id,
            command.actorEmployeeId,
            "status_change",
            existing.status,
            command.targetStatus,
            command.note,
            command.now,
          ),
      ])

      const repository = new EvaluationSheetRepository(this.c)
      const saved = await repository.findById(command.sheetId)

      if (saved instanceof Error || saved === null) {
        return new UnexpectedError("failed to read back submitted evaluation sheet")
      }

      return saved
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError(
          "submit failed: concurrent modification changed weight, goals, or revision",
          "concurrent_conflict",
        )
      }

      return error instanceof Error
        ? new UnexpectedError("failed to submit evaluation sheet", { cause: error })
        : new UnexpectedError("failed to submit evaluation sheet")
    }
  }

  /**
   * 提出時の目標 weight 不変条件を検証する。
   * - 目標が 1 件以上存在すること
   * - weight 合計がちょうど 100% であること
   */
  private async validateSubmitWeights(sheetId: number): Promise<ApplicationError | null> {
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
