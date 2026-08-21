import type { SQL } from "drizzle-orm"
import { and, asc, count, eq } from "drizzle-orm"
import { EvaluationSheet } from "@/contexts/performance-review/domain/evaluation-sheet/evaluation-sheet.entity"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { ConflictError } from "@/lib/errors"
import {
  evaluationSheetAuditLogs,
  evaluationSheets,
} from "@/contexts/performance-review/infrastructure/schema/performance-review"

export class EvaluationSheetRepository {
  constructor(private readonly c: Context) {}

  async findById(id: number): Promise<EvaluationSheet | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(evaluationSheets)
        .where(eq(evaluationSheets.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : EvaluationSheet.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load evaluation sheet")
    }
  }

  async findAll(opts?: {
    employeeId?: number
    period?: string
    status?: string
    limit: number
    offset: number
  }): Promise<{ data: ReadonlyArray<EvaluationSheet>; total: number } | Error> {
    try {
      const conditions: Array<SQL> = []

      if (opts?.employeeId !== undefined) {
        conditions.push(eq(evaluationSheets.employeeId, opts.employeeId))
      }

      if (opts?.period !== undefined) {
        conditions.push(eq(evaluationSheets.period, opts.period))
      }

      if (opts?.status !== undefined) {
        conditions.push(eq(evaluationSheets.status, opts.status))
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined

      const rows = await this.c.var.database
        .select()
        .from(evaluationSheets)
        .where(where)
        .orderBy(asc(evaluationSheets.id))
        .limit(opts?.limit ?? 50)
        .offset(opts?.offset ?? 0)

      const totalRows = await this.c.var.database
        .select({ total: count() })
        .from(evaluationSheets)
        .where(where)

      return {
        data: rows.map((row) => EvaluationSheet.fromRow(row)),
        total: totalRows.at(0)?.total ?? 0,
      }
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to list evaluation sheets")
    }
  }

  async create(sheet: EvaluationSheet): Promise<EvaluationSheet | Error> {
    try {
      const rows = await this.c.var.database
        .insert(evaluationSheets)
        .values({
          employeeId: sheet.employeeId,
          templateId: sheet.templateId,
          period: sheet.period,
          status: sheet.status,
          primaryEvaluatorId: sheet.primaryEvaluatorId,
          secondaryEvaluatorId: sheet.secondaryEvaluatorId,
          submittedAt: sheet.submittedAt,
          approvedAt: sheet.approvedAt,
          finalizedAt: sheet.finalizedAt,
          revision: sheet.revision,
          createdAt: sheet.createdAt,
          updatedAt: sheet.updatedAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create evaluation sheet")
        : EvaluationSheet.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create evaluation sheet")
    }
  }

  /**
   * 楽観的ロック付きで評価シートを更新する。
   * WHERE に revision を含め、一致しない場合は ConflictError を返す。
   */
  async update(sheet: EvaluationSheet): Promise<EvaluationSheet | null | Error> {
    try {
      if (sheet.id === null) {
        return new Error("cannot update unsaved evaluation sheet")
      }

      const rows = await this.c.var.database
        .update(evaluationSheets)
        .set({
          status: sheet.status,
          primaryEvaluatorId: sheet.primaryEvaluatorId,
          secondaryEvaluatorId: sheet.secondaryEvaluatorId,
          submittedAt: sheet.submittedAt,
          approvedAt: sheet.approvedAt,
          finalizedAt: sheet.finalizedAt,
          revision: sheet.revision,
          updatedAt: sheet.updatedAt,
        })
        .where(
          and(
            eq(evaluationSheets.id, sheet.id),
            // CAS: 更新元の revision と一致する場合のみ更新
            eq(evaluationSheets.revision, sheet.revision - 1),
          ),
        )
        .returning()

      const row = rows.at(0)

      if (row === undefined) {
        // revision 不一致 — 別のリクエストが先に更新した
        return new ConflictError(
          "evaluation sheet was modified by another request",
          "revision_conflict",
        )
      }

      return EvaluationSheet.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update evaluation sheet")
    }
  }

  /**
   * 作成と監査ログ追記を D1 batch でアトミックに実行する。
   */
  async createWithAuditLog(
    sheet: EvaluationSheet,
    audit: {
      actorId: number
      action: string
      fromValue: string | null
      toValue: string | null
      note: string | null
      now: string
    },
  ): Promise<EvaluationSheet | Error> {
    try {
      const db = this.c.env.DB

      // シート作成と監査ログ挿入を同一 batch でアトミックに実行する。
      // last_insert_rowid() は INSERT のみで更新されるため、SELECT（statement 1）の
      // 後も sheet の rowid を保持する。audit INSERT は statement 2 で実行。
      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO evaluation_sheets
               (employee_id, template_id, period, status, primary_evaluator_id,
                secondary_evaluator_id, submitted_at, approved_at, finalized_at,
                revision, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
          )
          .bind(
            sheet.employeeId,
            sheet.templateId,
            sheet.period,
            sheet.status,
            sheet.primaryEvaluatorId,
            sheet.secondaryEvaluatorId,
            sheet.submittedAt,
            sheet.approvedAt,
            sheet.finalizedAt,
            sheet.revision,
            sheet.createdAt,
            sheet.updatedAt,
          ),
        db.prepare(
          "SELECT id, employee_id, template_id, period, status, primary_evaluator_id, secondary_evaluator_id, submitted_at, approved_at, finalized_at, revision, created_at, updated_at FROM evaluation_sheets WHERE id = last_insert_rowid()",
        ),
        db
          .prepare(
            `INSERT INTO evaluation_sheet_audit_logs
               (sheet_id, actor_id, action, from_value, to_value, note, created_at)
             VALUES (last_insert_rowid(), ?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(audit.actorId, audit.action, audit.fromValue, audit.toValue, audit.note, audit.now),
      ])

      type SheetRow = {
        id: number
        employee_id: number
        template_id: number | null
        period: string
        status: string
        primary_evaluator_id: number
        secondary_evaluator_id: number | null
        submitted_at: string | null
        approved_at: string | null
        finalized_at: string | null
        revision: number
        created_at: string
        updated_at: string
      }

      const row = (results[1] as D1Result<SheetRow>).results?.at(0)

      if (row === undefined) {
        return new Error("failed to read back created evaluation sheet")
      }

      return EvaluationSheet.fromRow({
        id: row.id,
        employeeId: row.employee_id,
        templateId: row.template_id,
        period: row.period,
        status: row.status,
        primaryEvaluatorId: row.primary_evaluator_id,
        secondaryEvaluatorId: row.secondary_evaluator_id,
        submittedAt: row.submitted_at,
        approvedAt: row.approved_at,
        finalizedAt: row.finalized_at,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create evaluation sheet")
    }
  }

  /**
   * 状態更新と監査ログ追記を D1 batch でアトミックに実行する。
   * batch 全体が成功するか、全体が rollback される。
   */
  async updateWithAuditLog(
    sheet: EvaluationSheet,
    audit: {
      actorId: number
      action: string
      fromValue: string | null
      toValue: string | null
      note: string | null
      now: string
    },
  ): Promise<EvaluationSheet | Error> {
    try {
      if (sheet.id === null) {
        return new Error("cannot update unsaved evaluation sheet")
      }

      const db = this.c.env.DB

      await db.batch([
        db
          .prepare(
            `UPDATE evaluation_sheets
             SET status = ?1, primary_evaluator_id = ?2, secondary_evaluator_id = ?3,
                 submitted_at = ?4, approved_at = ?5, finalized_at = ?6,
                 revision = ?7, updated_at = ?8
             WHERE id = ?9 AND revision = ?10`,
          )
          .bind(
            sheet.status,
            sheet.primaryEvaluatorId,
            sheet.secondaryEvaluatorId,
            sheet.submittedAt,
            sheet.approvedAt,
            sheet.finalizedAt,
            sheet.revision,
            sheet.updatedAt,
            sheet.id,
            sheet.revision - 1, // CAS: expect previous revision
          ),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            `INSERT INTO evaluation_sheet_audit_logs
               (sheet_id, actor_id, action, from_value, to_value, note, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
          )
          .bind(
            sheet.id,
            audit.actorId,
            audit.action,
            audit.fromValue,
            audit.toValue,
            audit.note,
            audit.now,
          ),
      ])

      // batch succeeded (guard did not abort) — refetch the updated row
      const updated = await this.findById(sheet.id)

      if (updated instanceof Error || updated === null) {
        return new Error("failed to read back updated evaluation sheet")
      }

      return updated
    } catch (error) {
      // ガード文が abort した場合は CAS 失敗
      if (isAbortedByGuard(error)) {
        return new ConflictError(
          "evaluation sheet was modified by another request",
          "revision_conflict",
        )
      }

      return error instanceof Error ? error : new Error("failed to update evaluation sheet")
    }
  }

  /** 監査ログを 1 件追記する。 */
  async appendAuditLog(entry: {
    sheetId: number
    actorId: number
    action: string
    fromValue: string | null
    toValue: string | null
    note: string | null
    now: string
  }): Promise<null | Error> {
    try {
      await this.c.var.database.insert(evaluationSheetAuditLogs).values({
        sheetId: entry.sheetId,
        actorId: entry.actorId,
        action: entry.action,
        fromValue: entry.fromValue,
        toValue: entry.toValue,
        note: entry.note,
        createdAt: entry.now,
      })

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to append audit log")
    }
  }
}
