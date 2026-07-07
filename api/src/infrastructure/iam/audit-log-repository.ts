import type { Context } from "@/env"
import { auditLogs } from "@/schema"
import type { SQL } from "drizzle-orm"
import { and, count, desc, eq, gte, lte } from "drizzle-orm"

export type AuditLogEntry = {
  id: number
  actorAccountId: number | null
  action: string
  targetType: string | null
  targetId: number | null
  metadata: string | null
  ip: string | null
  createdAt: number
}

export type AuditLogSearch = {
  actorAccountId: number | null
  action: string | null
  targetType: string | null
  from: number | null
  to: number | null
  limit: number
  offset: number
}

export type AuditLogPage = {
  entries: ReadonlyArray<AuditLogEntry>
  total: number
}

/**
 * append-only な監査ログの読み取りを扱うリポジトリ。書き込み・削除は持たない。
 */
export class AuditLogRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /**
   * 監査ログをフィルタ・ページング付きで新しい順に返す。total はフィルタ適用後の総件数。
   */
  async search(search: AuditLogSearch): Promise<AuditLogPage | Error> {
    try {
      const conditions: Array<SQL> = []

      if (search.actorAccountId !== null) {
        conditions.push(eq(auditLogs.actorAccountId, search.actorAccountId))
      }

      if (search.action !== null) {
        conditions.push(eq(auditLogs.action, search.action))
      }

      if (search.targetType !== null) {
        conditions.push(eq(auditLogs.targetType, search.targetType))
      }

      if (search.from !== null) {
        conditions.push(gte(auditLogs.createdAt, search.from))
      }

      if (search.to !== null) {
        conditions.push(lte(auditLogs.createdAt, search.to))
      }

      const where = conditions.length === 0 ? undefined : and(...conditions)

      const db = this.c.var.database

      const rows = await db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.id))
        .limit(search.limit)
        .offset(search.offset)

      const totalRows = await db.select({ total: count() }).from(auditLogs).where(where)

      return {
        entries: rows.map((row) => ({
          id: row.id,
          actorAccountId: row.actorAccountId,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          metadata: row.metadata,
          ip: row.ip,
          createdAt: row.createdAt,
        })),
        total: totalRows.at(0)?.total ?? 0,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to search audit logs")
    }
  }
}
