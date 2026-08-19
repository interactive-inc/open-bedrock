import type { SystemAuditEvent, SystemAuditOutcome } from "@system/domain/audit/system-audit-event"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"

export type SystemAuditEventPage = Readonly<{
  events: ReadonlyArray<SystemAuditEvent>
  total: number
}>

type ListQuery = Readonly<{
  action: string | null
  actorAccountId: string | null
  outcome: SystemAuditOutcome | null
  targetType: string | null
  targetId: string | null
  occurredFrom: Date | null
  occurredTo: Date | null
  limit: number
  offset: number
}>

/** append-only System監査台帳を固定列・固定上限で読むquery adapter。 */
export class SystemAuditEventQuery {
  constructor(private readonly context: SystemD1Context) {
    Object.freeze(this)
  }

  async list(query: ListQuery): Promise<SystemAuditEventPage | Error> {
    try {
      const database = this.context.env.DB
      const bindings = [
        query.action,
        query.actorAccountId,
        query.outcome,
        query.targetType,
        query.targetId,
        query.occurredFrom?.getTime() ?? null,
        query.occurredTo?.getTime() ?? null,
      ] as const
      const where = `WHERE (?1 IS NULL OR action = ?1)
         AND (?2 IS NULL OR actor_account_id = ?2)
         AND (?3 IS NULL OR outcome = ?3)
         AND (?4 IS NULL OR target_type = ?4)
         AND (?5 IS NULL OR target_id = ?5)
         AND (?6 IS NULL OR occurred_at >= ?6)
         AND (?7 IS NULL OR occurred_at < ?7)`
      const results = await database.batch([
        database
          .prepare(
            `SELECT event_id, actor_account_id, action, target_type, target_id, outcome,
                    reason_code, authorization_json, before_json, after_json, metadata_json,
                    occurred_at
             FROM system_audit_events
             ${where}
             ORDER BY occurred_at DESC, event_id DESC
             LIMIT ?8 OFFSET ?9`,
          )
          .bind(...bindings, query.limit, query.offset),
        database
          .prepare(`SELECT count(*) AS total FROM system_audit_events ${where}`)
          .bind(...bindings),
      ])
      if (results.length !== 2 || results.some((result) => !result.success)) {
        return new Error("System audit query did not succeed")
      }

      const events: Array<SystemAuditEvent> = []
      for (const value of results[0]?.results ?? []) {
        const row = value as Record<string, unknown>
        if (
          typeof row.event_id !== "string" ||
          (row.actor_account_id !== null && typeof row.actor_account_id !== "string") ||
          typeof row.action !== "string" ||
          typeof row.target_type !== "string" ||
          (row.target_id !== null && typeof row.target_id !== "string") ||
          !["succeeded", "denied", "failed"].includes(String(row.outcome)) ||
          (row.reason_code !== null && typeof row.reason_code !== "string") ||
          (row.authorization_json !== null && typeof row.authorization_json !== "string") ||
          (row.before_json !== null && typeof row.before_json !== "string") ||
          (row.after_json !== null && typeof row.after_json !== "string") ||
          (row.metadata_json !== null && typeof row.metadata_json !== "string") ||
          typeof row.occurred_at !== "number" ||
          !Number.isSafeInteger(row.occurred_at) ||
          !Number.isFinite(new Date(row.occurred_at).getTime())
        ) {
          return new Error("System audit row is invalid")
        }
        events.push(
          Object.freeze({
            eventId: row.event_id,
            actorAccountId: row.actor_account_id,
            action: row.action,
            targetType: row.target_type,
            targetId: row.target_id,
            outcome: row.outcome as SystemAuditOutcome,
            reasonCode: row.reason_code,
            authorizationJson: row.authorization_json,
            beforeJson: row.before_json,
            afterJson: row.after_json,
            metadataJson: row.metadata_json,
            occurredAtEpochMilliseconds: row.occurred_at,
          }),
        )
      }
      const total = (results[1]?.results?.[0] as Record<string, unknown> | undefined)?.total
      if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
        return new Error("System audit total is invalid")
      }

      return Object.freeze({ events: Object.freeze(events), total })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System audit events")
    }
  }

  async findById(eventId: string): Promise<SystemAuditEvent | null | Error> {
    try {
      const row = await this.context.env.DB.prepare(
        `SELECT event_id, actor_account_id, action, target_type, target_id, outcome,
                reason_code, authorization_json, before_json, after_json, metadata_json,
                occurred_at
         FROM system_audit_events
         WHERE event_id = ?1
         LIMIT 1`,
      )
        .bind(eventId)
        .first<Record<string, unknown>>()
      if (row === null) return null
      if (
        typeof row.event_id !== "string" ||
        (row.actor_account_id !== null && typeof row.actor_account_id !== "string") ||
        typeof row.action !== "string" ||
        typeof row.target_type !== "string" ||
        (row.target_id !== null && typeof row.target_id !== "string") ||
        !["succeeded", "denied", "failed"].includes(String(row.outcome)) ||
        (row.reason_code !== null && typeof row.reason_code !== "string") ||
        (row.authorization_json !== null && typeof row.authorization_json !== "string") ||
        (row.before_json !== null && typeof row.before_json !== "string") ||
        (row.after_json !== null && typeof row.after_json !== "string") ||
        (row.metadata_json !== null && typeof row.metadata_json !== "string") ||
        typeof row.occurred_at !== "number" ||
        !Number.isSafeInteger(row.occurred_at) ||
        !Number.isFinite(new Date(row.occurred_at).getTime())
      ) {
        return new Error("System audit row is invalid")
      }

      return Object.freeze({
        eventId: row.event_id,
        actorAccountId: row.actor_account_id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        outcome: row.outcome as SystemAuditOutcome,
        reasonCode: row.reason_code,
        authorizationJson: row.authorization_json,
        beforeJson: row.before_json,
        afterJson: row.after_json,
        metadataJson: row.metadata_json,
        occurredAtEpochMilliseconds: row.occurred_at,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find System audit event")
    }
  }
}
