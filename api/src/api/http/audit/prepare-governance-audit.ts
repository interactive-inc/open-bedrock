import type { Session } from "@/lib/auth/session"
import type { AuditJsonValue } from "@/api/http/audit/company-audit-record.definition"
import {
  createAuditEvent,
  type AuditAction,
  type AuditTargetType,
} from "@/api/http/audit/company-audit-event.definition"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/api/http/audit/audit-event.repository"

export function prepareGovernanceAudit(props: {
  c: Context
  session: Session
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  metadata?: AuditJsonValue
}): readonly [D1PreparedStatement, D1PreparedStatement] {
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
  return new AuditEventRepository(props.c).prepareAppend(record)
}
