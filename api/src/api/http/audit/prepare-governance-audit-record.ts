import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { AuditJsonValue } from "@/api/http/audit/company-audit-record.definition"
import {
  createAuditEvent,
  type AuditAction,
  type AuditTargetType,
} from "@/api/http/audit/company-audit-event.definition"
import type { Context } from "@/env"
import { AuditEventAdapter } from "@/api/http/audit/audit-event.adapter"

/** Company監査の識別子と永続化断片を、呼出側の同一transactionへ渡す。 */
export function prepareGovernanceAuditRecord(props: {
  c: Context
  session: CompanySessionValue
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  metadata?: AuditJsonValue
}) {
  const record = createAuditEvent(
    {
      actorAccountId: props.session.accountId,
      actorEmployeeId: props.session.employeeId,
      action: props.action,
      target: { type: props.targetType, id: props.targetId },
      outcome: "succeeded",
      reasonCode: null,
      metadata: props.metadata,
      now: new Date(props.c.env.NOW ?? new Date().toISOString()),
    },
    props.c.var.auditContext,
  )
  return Object.freeze({
    eventId: record.eventId,
    statements: new AuditEventAdapter(props.c).prepareAppend(record),
  })
}
