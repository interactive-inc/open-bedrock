import type { RequestAuditContext } from "@/env"
import { ValidationError } from "@/lib/errors"
import { toStableAuditJson } from "@/lib/audit/stable-json"
import type { AuditJsonValue } from "@/lib/audit/stable-json"
import { z } from "zod"

export const auditActionSchema = z.enum([
  "auth.session.login_succeeded",
  "auth.session.login_denied",
  "auth.session.refreshed",
  "auth.session.reuse_detected",
  "iam.role.created",
  "iam.role.updated",
  "iam.role.deleted",
  "iam.account.role_granted",
  "iam.account.role_revoked",
  "iam.account.status_changed",
  "iam.account.password_reset",
  "employee.account.registered",
  "employee.account.retired",
  "employee.account.deleted",
  "application.workflow.updated",
  "application.workflow.repaired",
  "application.delegation.created",
  "application.delegation.cancelled",
  "application.decision.approved",
  "application.decision.rejected",
  "audit.event.searched",
  "audit.event.read",
  "audit.event.exported",
])

export const auditTargetTypeSchema = z.enum([
  "session",
  "role",
  "account",
  "employee",
  "application_workflow",
  "application",
  "approval_delegation",
  "audit_event",
  "audit_export",
])

export const auditOutcomeSchema = z.enum(["succeeded", "denied", "failed"])

export const auditClientNameSchema = z.enum(["web", "cli", "api", "system"])

export const auditRequestContextSchema = z.object({
  requestId: z.string().uuid(),
  clientName: auditClientNameSchema,
})

export type AuditAction = z.infer<typeof auditActionSchema>
export type AuditTargetType = z.infer<typeof auditTargetTypeSchema>
export type AuditOutcome = z.infer<typeof auditOutcomeSchema>

export type AuditEventInput = {
  actorAccountId: number | null
  actorEmployeeId: number | null
  action: AuditAction
  target: { type: AuditTargetType; id: string | null }
  outcome: AuditOutcome
  reasonCode: string | null
  authorization?: AuditJsonValue
  before?: AuditJsonValue
  after?: AuditJsonValue
  metadata?: AuditJsonValue
  now: Date
}

export type AuditEventRecord = {
  eventId: string
  requestId: string
  actorAccountId: number | null
  actorEmployeeId: number | null
  action: AuditAction
  targetType: AuditTargetType
  targetId: string | null
  outcome: AuditOutcome
  reasonCode: string | null
  authorizationJson: string | null
  beforeJson: string | null
  afterJson: string | null
  metadataJson: string | null
  clientIp: string | null
  clientName: z.infer<typeof auditClientNameSchema>
  createdAt: number
}

function serializeOptionalProjection(value: AuditJsonValue | undefined): string | null {
  return value === undefined ? null : toStableAuditJson(value)
}

function parseManagedValue<Output>(
  schema: z.ZodType<Output>,
  value: unknown,
  message: string,
  code: string,
): Output {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new ValidationError(message, code, { cause: parsed.error })
  }

  return parsed.data
}

/** Creates the immutable, database-ready projection for one managed audit event. */
export function createAuditEvent(
  input: AuditEventInput,
  context: RequestAuditContext,
): AuditEventRecord {
  const action = parseManagedValue(
    auditActionSchema,
    input.action,
    "audit event action is invalid",
    "audit_invalid_action",
  )
  const targetType = parseManagedValue(
    auditTargetTypeSchema,
    input.target.type,
    "audit event target type is invalid",
    "audit_invalid_target_type",
  )
  const outcome = parseManagedValue(
    auditOutcomeSchema,
    input.outcome,
    "audit event outcome is invalid",
    "audit_invalid_outcome",
  )
  const auditContext = parseManagedValue(
    auditRequestContextSchema,
    context,
    "audit request context is invalid",
    "audit_invalid_context",
  )
  const timestamp = input.now.getTime()
  if (!Number.isFinite(timestamp)) {
    throw new ValidationError("audit event time is invalid", "audit_invalid_timestamp")
  }

  return {
    eventId: crypto.randomUUID(),
    requestId: auditContext.requestId,
    actorAccountId: input.actorAccountId,
    actorEmployeeId: input.actorEmployeeId,
    action,
    targetType,
    targetId: input.target.id,
    outcome,
    reasonCode: input.reasonCode,
    authorizationJson: serializeOptionalProjection(input.authorization),
    beforeJson: serializeOptionalProjection(input.before),
    afterJson: serializeOptionalProjection(input.after),
    metadataJson: serializeOptionalProjection(input.metadata),
    clientIp: context.clientIp,
    clientName: auditContext.clientName,
    createdAt: Math.floor(timestamp / 1_000),
  }
}
