import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { SystemAuditJsonError } from "@system/domain/audit/system-audit-json-error"
import type { SystemAuditJsonValue } from "@system/domain/audit/system-audit-json-value"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"

export type AuditLogAppend = Readonly<{
  userId: string
  role: string
  action: string
  resourceType: string
  resourceId: string | null
  metadata: Readonly<Record<string, SystemAuditJsonValue>> | null
  createdAt: Date
}>

/**
 * System が所有する最小の監査エンベロープを D1 statement に変換する。
 *
 * Company / Care の語彙や書き込み順序は知らない。利用側がこの statement を自身の更新と同じ
 * D1 batch に含めることで、重要操作と監査証跡を同じ成功境界へ置ける。
 */
export function prepareAuditLogAppend(
  database: D1Database,
  props: AuditLogAppend,
): D1PreparedStatement {
  const event = createSystemAuditEvent({
    actorAccountId: props.userId,
    action: props.action,
    targetType: props.resourceType,
    targetId: props.resourceId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: serializeMetadata(props.metadata),
    occurredAt: props.createdAt,
  })
  if (event instanceof Error) throw event

  return database
    .prepare(
      `INSERT INTO audit_logs (
        id,
        user_id,
        role,
        action,
        resource_type,
        resource_id,
        metadata,
        created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      event.eventId,
      event.actorAccountId,
      props.role,
      event.action,
      event.targetType,
      event.targetId,
      event.metadataJson,
      event.occurredAtEpochMilliseconds,
    )
}

function serializeMetadata(metadata: AuditLogAppend["metadata"]): string | null {
  const serialized = toStableSystemAuditJson(metadata)
  if (serialized instanceof SystemAuditJsonError) throw serialized

  return serialized
}
