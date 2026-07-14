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
  "employee.lifecycle.applied",
  "employee.lifecycle.corrected",
  "employee.lifecycle.read",
  "employee.lifecycle.read_all",
  "employee.lifecycle.denied",
  "employee.lifecycle.requested",
  "employee.lifecycle.request_withdrawn",
  "employee.archived",
  "employee.lifecycle.projections_rebuilt",
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

export const auditRequestContextSchema = z.strictObject({
  requestId: z.string().uuid(),
  clientName: auditClientNameSchema,
  clientIp: z.string().nullable(),
  externalRequestId: z.string().nullable(),
})

const auditActorIdSchema = z.number().int().safe().positive().nullable()

const auditEventEnvelopeSchema = z.strictObject({
  actorAccountId: auditActorIdSchema,
  actorEmployeeId: auditActorIdSchema,
  action: z.unknown(),
  target: z.unknown(),
  outcome: z.unknown(),
  reasonCode: z.string().nullable(),
  authorization: z.unknown().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  metadata: z.unknown().optional(),
  now: z.unknown(),
})

const auditTargetShapeSchema = z.strictObject({
  type: z.string().min(1),
  id: z.string().min(1).nullable(),
})

const auditEventTimeSchema = z.date()

export type AuditAction = z.infer<typeof auditActionSchema>
export type AuditTargetType = z.infer<typeof auditTargetTypeSchema>
export type AuditOutcome = z.infer<typeof auditOutcomeSchema>
export type AuditClientName = z.infer<typeof auditClientNameSchema>

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
  clientName: AuditClientName
  createdAt: number
}

/** Legacy-tolerant list projection. Managed write vocabulary remains closed in AuditEventRecord. */
export type AuditEventSummary = {
  eventId: string
  requestId: string
  actorAccountId: number | null
  actorEmployeeId: number | null
  action: string
  targetType: string | null
  targetId: string | null
  outcome: AuditOutcome
  reasonCode: string | null
  clientName: AuditClientName
  createdAt: number
}

/** Full read projection. JSON columns remain immutable database text and are not reserialized. */
export type AuditEventDetail = AuditEventSummary & {
  authorizationJson: string | null
  beforeJson: string | null
  afterJson: string | null
  metadataJson: string | null
  clientIp: string | null
}

function serializeOptionalProjection(value: unknown): string | null {
  return value === undefined ? null : toStableAuditJson(value as AuditJsonValue)
}

function parseManagedValue<Output>(
  schema: z.ZodType<Output>,
  value: unknown,
  message: string,
  code: string,
): Output {
  let parsed: z.SafeParseReturnType<unknown, Output>
  try {
    parsed = schema.safeParse(value)
  } catch (error) {
    throw new ValidationError(message, code, { cause: error })
  }
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
  const eventInput = parseManagedValue(
    auditEventEnvelopeSchema,
    input,
    "audit event input is invalid",
    "audit_invalid_event",
  )
  const action = parseManagedValue(
    auditActionSchema,
    eventInput.action,
    "audit event action is invalid",
    "audit_invalid_action",
  )
  const target = parseManagedValue(
    auditTargetShapeSchema,
    eventInput.target,
    "audit event target is invalid",
    "audit_invalid_target",
  )
  const targetType = parseManagedValue(
    auditTargetTypeSchema,
    target.type,
    "audit event target type is invalid",
    "audit_invalid_target_type",
  )
  const outcome = parseManagedValue(
    auditOutcomeSchema,
    eventInput.outcome,
    "audit event outcome is invalid",
    "audit_invalid_outcome",
  )
  const auditContext = parseManagedValue(
    auditRequestContextSchema,
    context,
    "audit request context is invalid",
    "audit_invalid_context",
  )
  const eventTime = parseManagedValue(
    auditEventTimeSchema,
    eventInput.now,
    "audit event time is invalid",
    "audit_invalid_timestamp",
  )
  const timestamp = Date.prototype.getTime.call(eventTime)
  if (!Number.isFinite(timestamp)) {
    throw new ValidationError("audit event time is invalid", "audit_invalid_timestamp")
  }

  return {
    eventId: crypto.randomUUID(),
    requestId: auditContext.requestId,
    actorAccountId: eventInput.actorAccountId,
    actorEmployeeId: eventInput.actorEmployeeId,
    action,
    targetType,
    targetId: target.id,
    outcome,
    reasonCode: eventInput.reasonCode,
    authorizationJson: serializeOptionalProjection(eventInput.authorization),
    beforeJson: serializeOptionalProjection(eventInput.before),
    afterJson: serializeOptionalProjection(eventInput.after),
    metadataJson: serializeOptionalProjection(eventInput.metadata),
    clientIp: auditContext.clientIp,
    clientName: auditContext.clientName,
    createdAt: Math.floor(timestamp / 1_000),
  }
}
