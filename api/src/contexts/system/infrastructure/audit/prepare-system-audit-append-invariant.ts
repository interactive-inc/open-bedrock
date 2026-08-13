import type { SystemAuditEvent } from "@system/domain/audit/system-audit-event"

/** append後のSystem監査イベントが入力と完全一致することをtransaction内で検証する。 */
export function prepareSystemAuditAppendInvariant(
  database: D1Database,
  record: SystemAuditEvent,
): D1PreparedStatement {
  return database
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
