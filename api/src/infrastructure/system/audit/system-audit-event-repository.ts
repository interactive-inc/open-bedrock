import type { SystemAuditEventRecord } from "@/domain/system/audit/audit-event"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"

/** 上位コンテキストを持たない System 監査イベントの append 専用 repository。 */
export class SystemAuditEventRepository {
  constructor(private readonly c: Context) {}

  prepareAppend(
    record: SystemAuditEventRecord,
  ): readonly [D1PreparedStatement, D1PreparedStatement] {
    const insert = this.c.env.DB.prepare(
      `INSERT INTO audit_events
         (event_id, request_id, actor_account_id, action, target_type, target_id, outcome,
          reason_code, authorization_json, before_json, after_json, metadata_json, client_ip,
          client_name, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
    ).bind(
      record.eventId,
      record.requestId,
      record.actorAccountId,
      record.action,
      record.targetType,
      record.targetId,
      record.outcome,
      record.reasonCode,
      record.authorizationJson,
      record.beforeJson,
      record.afterJson,
      record.metadataJson,
      record.clientIp,
      record.clientName,
      record.createdAt,
    )

    const statements: [D1PreparedStatement, D1PreparedStatement] = [
      insert,
      abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
    ]

    return Object.freeze(statements)
  }

  async append(record: SystemAuditEventRecord): Promise<void | Error> {
    try {
      const results = await this.c.env.DB.batch([...this.prepareAppend(record)])
      return results.length === 2 && results.every((result) => result.success)
        ? undefined
        : new Error("audit append did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("audit append failed")
    }
  }
}
