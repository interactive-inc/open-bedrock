import type { SystemContext } from "@system/infrastructure/configuration/system-context"
import type { SystemAuditEvent } from "@system/domain/audit/system-audit-event"

function prepareAppendInvariant(db: D1Database, record: SystemAuditEvent): D1PreparedStatement {
  return db
    .prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM system_audit_events
         WHERE event_id = ?1
           AND actor_account_id IS ?2
           AND action = ?3
           AND target_type = ?4
           AND target_id IS ?5
           AND outcome = ?6
           AND reason_code IS ?7
           AND authorization_json IS ?8
           AND before_json IS ?9
           AND after_json IS ?10
           AND metadata_json IS ?11
           AND occurred_at = ?12
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(
      record.eventId,
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
      record.occurredAtEpochMilliseconds,
    )
}

/** 上位コンテキストを持たない System 監査イベントの append 専用 repository。 */
export class SystemAuditEventRepository {
  constructor(private readonly c: SystemContext) {}

  prepareAppend(record: SystemAuditEvent): readonly [D1PreparedStatement, D1PreparedStatement] {
    const insert = this.c.env.DB.prepare(
      `INSERT INTO system_audit_events
         (event_id, actor_account_id, action, target_type, target_id, outcome, reason_code,
          authorization_json, before_json, after_json, metadata_json, occurred_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    ).bind(
      record.eventId,
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
      record.occurredAtEpochMilliseconds,
    )

    const statements: [D1PreparedStatement, D1PreparedStatement] = [
      insert,
      prepareAppendInvariant(this.c.env.DB, record),
    ]

    return Object.freeze(statements)
  }

  async append(record: SystemAuditEvent): Promise<void | Error> {
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
