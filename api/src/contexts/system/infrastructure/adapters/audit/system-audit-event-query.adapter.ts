import {
  SystemAuditEventEntity,
  type SystemAuditEventProps,
  type SystemAuditOutcome,
} from "@system/domain/entities/system-audit-event.entity"
import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemAuditEventPage = Readonly<{
  events: ReadonlyArray<SystemAuditEventEntity>
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

function restoreEvent(row: Record<string, unknown>): SystemAuditEventEntity | Error {
  return SystemAuditEventEntity.restore({
    eventId: row.event_id,
    actorAccountId: row.actor_account_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    outcome: row.outcome,
    reasonCode: row.reason_code,
    authorizationJson: row.authorization_json,
    beforeJson: row.before_json,
    afterJson: row.after_json,
    metadataJson: row.metadata_json,
    occurredAtEpochMilliseconds: row.occurred_at,
  } as SystemAuditEventProps)
}
type Context = SystemD1Context

/** append-only System監査台帳を固定列・固定上限で読むquery adapter。 */
export class SystemAuditEventQueryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async list(query: ListQuery): Promise<SystemAuditEventPage | Error> {
    try {
      const database = this.c.env.DB
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

      const events: Array<SystemAuditEventEntity> = []
      for (const value of results[0]?.results ?? []) {
        const row = value as Record<string, unknown>
        const event = restoreEvent(row)
        if (event instanceof Error)
          return new Error("System audit row is invalid", { cause: event })
        events.push(event)
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

  async findById(eventId: string): Promise<SystemAuditEventEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
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
      const event = restoreEvent(row)
      return event instanceof Error
        ? new Error("System audit row is invalid", { cause: event })
        : event
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find System audit event")
    }
  }
}
