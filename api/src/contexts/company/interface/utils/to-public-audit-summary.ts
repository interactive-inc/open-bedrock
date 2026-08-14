import type { AuditEventSummary } from "@/composition/audit/audit-event"
import { toAuditIsoString } from "@/contexts/company/interface/utils/to-audit-iso-string"
import { zAppAuditEventSummary } from "@/lib/app-schemas"
import type { AppAuditEventSummary } from "@/lib/app-schemas"

/** Projects the shared public summary fields, converting the timestamp to UTC. */
export function toPublicAuditSummary(item: AuditEventSummary): AppAuditEventSummary {
  return zAppAuditEventSummary.parse({
    event_id: item.eventId,
    request_id: item.requestId,
    actor_account_id: item.actorAccountId,
    actor_employee_id: item.actorEmployeeId,
    action: item.action,
    target_type: item.targetType,
    target_id: item.targetId,
    outcome: item.outcome,
    reason_code: item.reasonCode,
    client_name: item.clientName,
    created_at: toAuditIsoString(item.createdAt),
  })
}
