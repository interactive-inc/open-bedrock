import { EvaluationSheet } from "@/domain/evaluation-sheet/evaluation-sheet.entity"
import type { Context } from "@/env"
import { evaluationSheetAuditLogs, evaluationSheets } from "@/schema"
import { and, asc, eq, count } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

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
          updatedAt: sheet.updatedAt,
        })
        .where(eq(evaluationSheets.id, sheet.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : EvaluationSheet.fromRow(row)
    } catch (error) {
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
