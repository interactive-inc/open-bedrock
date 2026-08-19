import type { SystemDatabase } from "@system/infrastructure/configuration/system-context"
import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { SystemAuditJsonError } from "@system/domain/audit/system-audit-json-error"
import { toStableSystemAuditJson } from "@system/domain/audit/to-stable-system-audit-json"
import type { AuditLogAppend } from "@/contexts/system/infrastructure/audit/audit-log-appender"
import { auditLogs } from "@/contexts/system/infrastructure/schema/system-runtime"

/** 共通監査エンベロープをDrizzle D1 batch用のappend queryへ適応する。 */
export function prepareDrizzleAuditLogAppend(database: SystemDatabase, props: AuditLogAppend) {
  const metadataJson = toStableSystemAuditJson(props.metadata)
  if (metadataJson instanceof SystemAuditJsonError) throw metadataJson

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
    metadataJson,
    occurredAt: props.createdAt,
  })
  if (event instanceof Error) throw event

  return database
    .insert(auditLogs)
    .values({
      id: event.eventId,
      userId: props.userId,
      role: props.role,
      action: event.action,
      resourceType: event.targetType,
      resourceId: event.targetId,
      metadata: event.metadataJson,
      createdAt: new Date(event.occurredAtEpochMilliseconds),
    })
    .returning({ id: auditLogs.id })
}
