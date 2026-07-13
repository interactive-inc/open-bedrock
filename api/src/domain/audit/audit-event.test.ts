import { describe, expect, test } from "bun:test"
import type { RequestAuditContext } from "@/env"
import { ValidationError } from "@/lib/errors"
import {
  auditActionSchema,
  auditOutcomeSchema,
  auditTargetTypeSchema,
  createAuditEvent,
} from "@/domain/audit/audit-event"
import type {
  AuditAction,
  AuditEventInput,
  AuditOutcome,
  AuditTargetType,
} from "@/domain/audit/audit-event"

const actions = [
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
] as const satisfies readonly AuditAction[]

const targetTypes = [
  "session",
  "role",
  "account",
  "employee",
  "application_workflow",
  "application",
  "approval_delegation",
  "audit_event",
  "audit_export",
] as const satisfies readonly AuditTargetType[]

const outcomes = ["succeeded", "denied", "failed"] as const satisfies readonly AuditOutcome[]

const acceptsAction = (_value: AuditAction): void => undefined
const acceptsTargetType = (_value: AuditTargetType): void => undefined
const acceptsOutcome = (_value: AuditOutcome): void => undefined

// @ts-expect-error AuditAction is a closed union.
acceptsAction("free.form.action")
// @ts-expect-error AuditTargetType is a closed union.
acceptsTargetType("free_form_target")
// @ts-expect-error AuditOutcome is a closed union.
acceptsOutcome("unknown")

const context: RequestAuditContext = {
  requestId: "a7648f3e-fcde-4bc8-a637-4743e3cb2e45",
  clientName: "cli",
  clientIp: "203.0.113.10",
  externalRequestId: "external-request-7",
}

function makeInput(overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    actorAccountId: 31,
    actorEmployeeId: 41,
    action: "iam.role.updated",
    target: { type: "role", id: "security-reviewer" },
    outcome: "succeeded",
    reasonCode: "role_updated",
    authorization: { permission: "iam:role:update" },
    before: { permissions: ["iam:read"] },
    after: { permissions: ["iam:read", "iam:role:update"] },
    metadata: { source: "role-console" },
    now: new Date("2026-07-14T12:34:56.987Z"),
    ...overrides,
  }
}

describe("audit event vocabulary", () => {
  test("accepts exactly the 23 managed actions", () => {
    expect(auditActionSchema.options).toEqual([...actions])
    for (const action of actions) {
      expect(auditActionSchema.parse(action)).toBe(action)
    }
    expect(() => auditActionSchema.parse("free.form.action")).toThrow()
  })

  test("accepts exactly the 9 managed target types", () => {
    expect(auditTargetTypeSchema.options).toEqual([...targetTypes])
    for (const targetType of targetTypes) {
      expect(auditTargetTypeSchema.parse(targetType)).toBe(targetType)
    }
    expect(() => auditTargetTypeSchema.parse("free_form_target")).toThrow()
  })

  test("accepts exactly the 3 managed outcomes", () => {
    expect(auditOutcomeSchema.options).toEqual([...outcomes])
    for (const outcome of outcomes) {
      expect(auditOutcomeSchema.parse(outcome)).toBe(outcome)
    }
    expect(() => auditOutcomeSchema.parse("unknown")).toThrow()
  })
})

describe("createAuditEvent", () => {
  test("creates a flattened Drizzle-compatible record", () => {
    const record = createAuditEvent(makeInput(), context)

    expect(record).toEqual({
      eventId: record.eventId,
      requestId: context.requestId,
      actorAccountId: 31,
      actorEmployeeId: 41,
      action: "iam.role.updated",
      targetType: "role",
      targetId: "security-reviewer",
      outcome: "succeeded",
      reasonCode: "role_updated",
      authorizationJson: '{"permission":"iam:role:update"}',
      beforeJson: '{"permissions":["iam:read"]}',
      afterJson: '{"permissions":["iam:read","iam:role:update"]}',
      metadataJson: '{"source":"role-console"}',
      clientIp: "203.0.113.10",
      clientName: "cli",
      createdAt: 1_784_032_496,
    })
  })

  test("creates unique RFC 4122 version 4 event IDs and copies the internal request ID", () => {
    const first = createAuditEvent(makeInput(), context)
    const second = createAuditEvent(makeInput(), context)
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

    expect(first.eventId).toMatch(uuidV4)
    expect(second.eventId).toMatch(uuidV4)
    expect(first.eventId).not.toBe(second.eventId)
    expect(first.requestId).toBe(context.requestId)
  })

  test("copies nullable actors, target, result, reason, and client context", () => {
    const anonymousContext: RequestAuditContext = {
      requestId: "b0a622dc-31f8-49ec-bf69-54cd5777a0d0",
      clientName: "api",
      clientIp: null,
      externalRequestId: null,
    }
    const record = createAuditEvent(
      makeInput({
        actorAccountId: null,
        actorEmployeeId: null,
        action: "auth.session.login_denied",
        target: { type: "session", id: null },
        outcome: "denied",
        reasonCode: "invalid_credentials",
      }),
      anonymousContext,
    )

    expect(record.actorAccountId).toBeNull()
    expect(record.actorEmployeeId).toBeNull()
    expect(record.action).toBe("auth.session.login_denied")
    expect(record.targetType).toBe("session")
    expect(record.targetId).toBeNull()
    expect(record.outcome).toBe("denied")
    expect(record.reasonCode).toBe("invalid_credentials")
    expect(record.clientName).toBe("api")
    expect(record.clientIp).toBeNull()
  })

  test("serializes all four JSON columns independently and redacts each one", () => {
    const record = createAuditEvent(
      makeInput({
        authorization: { z: 1, token: "authorization-token" },
        before: [null, { password_hash: "before-secret" }],
        after: { nested: { client_secret: "after-secret", a: true } },
        metadata: { refresh_token: "metadata-secret", token_version: 9 },
      }),
      context,
    )

    expect(record.authorizationJson).toBe('{"token":"[REDACTED]","z":1}')
    expect(record.beforeJson).toBe('[null,{"password_hash":"[REDACTED]"}]')
    expect(record.afterJson).toBe('{"nested":{"a":true,"client_secret":"[REDACTED]"}}')
    expect(record.metadataJson).toBe('{"refresh_token":"[REDACTED]","token_version":9}')
  })

  test("maps omitted and root-null JSON projections to SQL null", () => {
    const record = createAuditEvent(
      makeInput({ authorization: null, before: undefined, after: null, metadata: undefined }),
      context,
    )

    expect(record.authorizationJson).toBeNull()
    expect(record.beforeJson).toBeNull()
    expect(record.afterJson).toBeNull()
    expect(record.metadataJson).toBeNull()
  })

  test("floors the event time to Unix seconds", () => {
    const record = createAuditEvent(
      makeInput({ now: new Date("1970-01-01T00:00:01.999Z") }),
      context,
    )

    expect(record.createdAt).toBe(1)
  })

  test("rejects an invalid event time with a stable application error", () => {
    try {
      createAuditEvent(makeInput({ now: new Date(Number.NaN) }), context)
      throw new Error("expected createAuditEvent to reject an invalid date")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_timestamp")
    }
  })
})
