import type { Session } from "@/contexts/company/domain/iam/session"
import {
  createAuditEvent,
  type AuditAction,
  type AuditTargetType,
} from "@/composition/audit/audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/infrastructure/company/audit/audit-event-repository"
import type { AuditJsonValue } from "@/contexts/system/application/audit/stable-json"

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
