import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { prepareSystemAuditAppendInvariant } from "@system/infrastructure/audit/prepare-system-audit-append-invariant.repository"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"

/** 上位コンテキストを持たないSystem監査イベントのappend専用repository。 */
export class SystemAuditEventRepository {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  prepareAppend(
    record: SystemAuditEventEntity,
  ): readonly [D1PreparedStatement, D1PreparedStatement] {
    const database = this.context.env.DB
    const insert = database
      .prepare(
        `INSERT INTO system_audit_events
           (event_id, actor_account_id, action, target_type, target_id, outcome, reason_code,
            authorization_json, before_json, after_json, metadata_json, occurred_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
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

    return Object.freeze([insert, prepareSystemAuditAppendInvariant(database, record)])
  }

  async append(record: SystemAuditEventEntity): Promise<void | Error> {
    try {
      const statements = this.prepareAppend(record)
      const results = await this.context.env.DB.batch([...statements])

      return results.length === 2 && results.every((result) => result.success)
        ? undefined
        : new Error("audit append did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("audit append failed")
    }
  }
}
