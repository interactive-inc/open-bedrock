import { createSystemAuditEvent as createSystemAuditEventEnvelope } from "@/domain/system/audit/create-system-audit-event"
import type { SystemAuditEventRecord } from "@/infrastructure/system/audit/system-audit-event-repository"
import type { AuditJsonValue } from "@/lib/audit/stable-json"
import { toStableAuditJson } from "@/lib/audit/stable-json"
import { ValidationError } from "@/lib/errors"
import { z } from "zod"

export const auditOutcomeSchema = z.enum(["succeeded", "denied", "failed"])
export const auditClientNameSchema = z.enum(["web", "cli", "api", "system"])
export const auditRequestContextSchema = z.strictObject({
  requestId: z.string().uuid(),
  clientName: auditClientNameSchema,
  clientIp: z.string().nullable(),
  externalRequestId: z.string().nullable(),
})

const actorIdSchema = z.number().int().safe().positive().nullable()
const actionSchema = z.string().regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u)
const targetTypeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/u)
const targetSchema = z.strictObject({ type: targetTypeSchema, id: z.string().min(1).nullable() })
const eventTimeSchema = z.date()
const eventEnvelopeSchema = z.strictObject({
  actorAccountId: actorIdSchema,
  action: actionSchema,
  target: targetSchema,
  outcome: auditOutcomeSchema,
  reasonCode: z.string().nullable(),
  authorization: z.unknown().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  metadata: z.unknown().optional(),
  now: z.unknown(),
})

export type AuditOutcome = z.infer<typeof auditOutcomeSchema>
export type AuditClientName = z.infer<typeof auditClientNameSchema>
export type AuditRequestContext = z.infer<typeof auditRequestContextSchema>

export type SystemAuditEventInput = Readonly<{
  actorAccountId: number | null
  action: string
  target: Readonly<{ type: string; id: string | null }>
  outcome: AuditOutcome
  reasonCode: string | null
  authorization?: AuditJsonValue
  before?: AuditJsonValue
  after?: AuditJsonValue
  metadata?: AuditJsonValue
  now: Date
}>

export type { SystemAuditEventRecord }

export type SystemAuditEventSummary = Readonly<{
  eventId: string
  requestId: string
  actorAccountId: number | null
  action: string
  targetType: string | null
  targetId: string | null
  outcome: AuditOutcome
  reasonCode: string | null
  clientName: AuditClientName
  createdAt: number
}>

export type SystemAuditEventDetail = SystemAuditEventSummary &
  Readonly<{
    authorizationJson: string | null
    beforeJson: string | null
    afterJson: string | null
    metadataJson: string | null
    clientIp: string | null
  }>

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

function serializeOptionalProjection(value: AuditJsonValue | undefined): string | null {
  return value === undefined ? null : toStableAuditJson(value)
}

/** Account を主体とする汎用の append-only 監査エンベロープを生成する。 */
export function createSystemAuditEvent(
  input: SystemAuditEventInput,
  context: AuditRequestContext,
): SystemAuditEventRecord {
  const eventInput = parseManagedValue(
    eventEnvelopeSchema,
    input,
    "audit event input is invalid",
    "audit_invalid_event",
  )
  const auditContext = parseManagedValue(
    auditRequestContextSchema,
    context,
    "audit request context is invalid",
    "audit_invalid_context",
  )
  const eventTime = parseManagedValue(
    eventTimeSchema,
    eventInput.now,
    "audit event time is invalid",
    "audit_invalid_timestamp",
  )
  const timestamp = Date.prototype.getTime.call(eventTime)
  if (!Number.isFinite(timestamp)) {
    throw new ValidationError("audit event time is invalid", "audit_invalid_timestamp")
  }

  const event = createSystemAuditEventEnvelope({
    actorAccountId: eventInput.actorAccountId,
    action: eventInput.action,
    targetType: eventInput.target.type,
    targetId: eventInput.target.id,
    outcome: eventInput.outcome,
    reasonCode: eventInput.reasonCode,
    authorizationJson: serializeOptionalProjection(input.authorization),
    beforeJson: serializeOptionalProjection(input.before),
    afterJson: serializeOptionalProjection(input.after),
    metadataJson: serializeOptionalProjection(input.metadata),
    occurredAt: eventTime,
  })
  if (event instanceof Error) {
    throw new ValidationError("audit event input is invalid", "audit_invalid_event", {
      cause: event,
    })
  }

  return {
    eventId: event.eventId,
    requestId: auditContext.requestId,
    actorAccountId: event.actorAccountId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    outcome: event.outcome,
    reasonCode: event.reasonCode,
    authorizationJson: event.authorizationJson,
    beforeJson: event.beforeJson,
    afterJson: event.afterJson,
    metadataJson: event.metadataJson,
    clientIp: auditContext.clientIp,
    clientName: auditContext.clientName,
    createdAt: Math.floor(event.occurredAtEpochMilliseconds / 1_000),
  }
}
