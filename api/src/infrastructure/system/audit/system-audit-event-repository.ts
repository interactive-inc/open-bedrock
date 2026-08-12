import type { Context } from "@/env"

export type SystemAuditEventRecord = Readonly<{
  eventId: string
  requestId: string
  actorAccountId: number | null
  action: string
  targetType: string
  targetId: string | null
  outcome: "succeeded" | "denied" | "failed"
  reasonCode: string | null
  authorizationJson: string | null
  beforeJson: string | null
  afterJson: string | null
  metadataJson: string | null
  clientIp: string | null
  clientName: "web" | "cli" | "api" | "system"
  createdAt: number
}>

function prepareAppendInvariant(
  db: D1Database,
  record: SystemAuditEventRecord,
): D1PreparedStatement {
  return db
    .prepare(
      `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM audit_events
         WHERE event_id = ?1
           AND request_id = ?2
           AND actor_account_id IS ?3
           AND action = ?4
           AND target_type = ?5
           AND target_id IS ?6
           AND outcome = ?7
           AND reason_code IS ?8
           AND authorization_json IS ?9
           AND before_json IS ?10
           AND after_json IS ?11
           AND metadata_json IS ?12
           AND client_ip IS ?13
           AND client_name = ?14
           AND created_at = ?15
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(
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
}

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
      prepareAppendInvariant(this.c.env.DB, record),
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
