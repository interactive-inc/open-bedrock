import { describe, expect, test } from "bun:test"
import type { RequestAuditContext } from "@/env"
import { ValidationError } from "@/lib/errors"
import {
  auditActionSchema,
  auditOutcomeSchema,
  auditTargetTypeSchema,
  createAuditEvent,
} from "@/contexts/company-compatibility/application/audit/company-audit-event"
import type {
  AuditAction,
  AuditEventInput,
  AuditOutcome,
  AuditTargetType,
} from "@/contexts/company-compatibility/application/audit/company-audit-event"

const actions = [
  "auth.session.login_succeeded",
  "auth.session.login_denied",
  "auth.session.refreshed",
  "auth.session.logout",
  "auth.session.reuse_detected",
  "auth.bootstrap.completed",
  "iam.role.created",
  "iam.role.updated",
  "iam.role.deleted",
  "iam.account.role_granted",
  "iam.account.role_revoked",
  "iam.account.status_changed",
  "iam.account.password_reset",
  "iam.identity.provisioned",
  "iam.identity.provision_updated",
  "auth.session.identity_login_succeeded",
  "auth.session.identity_login_denied",
  "auth.session.cli_login_succeeded",
  "auth.session.cli_login_denied",
  "auth.session.browser_login_succeeded",
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
  "governance.document.synced",
  "governance.review.submitted",
  "governance.review.decided",
  "governance.document.published",
  "governance.document.acknowledged",
  "governance.org_role.assigned",
  "governance.org_role.revoked",
  "audit.event.searched",
  "audit.event.read",
  "audit.event.exported",
] as const satisfies readonly AuditAction[]

const targetTypes = [
  "session",
  "role",
  "account",
  "identity",
  "employee",
  "application_workflow",
  "application",
  "approval_delegation",
  "governance_document",
  "governance_version",
  "governance_org_role",
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
  test("accepts exactly the 47 managed actions", () => {
    expect(auditActionSchema.options).toEqual([...actions])
    for (const action of actions) {
      expect(auditActionSchema.parse(action)).toBe(action)
    }
    expect(() => auditActionSchema.parse("free.form.action")).toThrow()
  })

  test("accepts exactly the 13 managed target types", () => {
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
  test.each([
    ["null", null],
    ["a primitive", "invalid"],
    ["an array", []],
  ])("rejects %s event envelope with a stable application error", (_name, value) => {
    try {
      createAuditEvent(value as unknown as AuditEventInput, context)
      throw new Error("expected createAuditEvent to reject an invalid event envelope")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_event")
      expect((error as ValidationError).message).toBe("audit event input is invalid")
    }
  })

  test.each([
    ["a missing target", undefined],
    ["a null target", null],
    ["an array target", []],
    ["a missing target ID", { type: "role" }],
    ["an empty target ID", { type: "role", id: "" }],
    ["a non-string target ID", { type: "role", id: 42 }],
    ["an extra target property", { type: "role", id: "target-1", extra: true }],
  ])("rejects %s with a stable target error", (_name, target) => {
    const unsafeInput = { ...makeInput(), target } as unknown as AuditEventInput

    try {
      createAuditEvent(unsafeInput, context)
      throw new Error("expected createAuditEvent to reject an invalid target")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_target")
      expect((error as ValidationError).message).toBe("audit event target is invalid")
    }
  })

  test("normalizes a throwing target accessor to the stable target error", () => {
    const target = Object.create(null) as Record<string, unknown>
    Object.defineProperty(target, "type", {
      enumerable: true,
      get() {
        throw new TypeError("target accessor must stay internal")
      },
    })
    target.id = "target-1"

    try {
      createAuditEvent({ ...makeInput(), target } as unknown as AuditEventInput, context)
      throw new Error("expected createAuditEvent to reject a throwing target accessor")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_target")
      expect((error as ValidationError).message).toBe("audit event target is invalid")
    }
  })

  test.each([
    ["a zero account actor", { actorAccountId: 0 }],
    ["a fractional employee actor", { actorEmployeeId: 2.5 }],
    ["an unsafe account actor", { actorAccountId: Number.MAX_SAFE_INTEGER + 1 }],
    ["an undefined reason", { reasonCode: undefined }],
    ["a non-string reason", { reasonCode: 42 }],
  ])("rejects %s instead of returning a non-database-ready record", (_name, overrides) => {
    const unsafeInput = { ...makeInput(), ...overrides } as unknown as AuditEventInput

    try {
      createAuditEvent(unsafeInput, context)
      throw new Error("expected createAuditEvent to reject invalid core input")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_event")
      expect((error as ValidationError).message).toBe("audit event input is invalid")
    }
  })

  test("rejects a non-Date event time with the timestamp error contract", () => {
    const unsafeInput = {
      ...makeInput(),
      now: "2026-07-14T12:34:56.987Z",
    } as unknown as AuditEventInput

    try {
      createAuditEvent(unsafeInput, context)
      throw new Error("expected createAuditEvent to reject a non-Date event time")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_timestamp")
      expect((error as ValidationError).message).toBe("audit event time is invalid")
    }
  })

  test("rejects an unmanaged action with a stable application error", () => {
    const unsafeInput = {
      ...makeInput(),
      action: "free.form.action",
    } as unknown as AuditEventInput

    try {
      createAuditEvent(unsafeInput, context)
      throw new Error("expected createAuditEvent to reject an unmanaged action")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_action")
      expect((error as ValidationError).message).toBe("audit event action is invalid")
    }
  })

  test("rejects an unmanaged target type with a stable application error", () => {
    const unsafeInput = {
      ...makeInput(),
      target: { type: "free_form_target", id: "target-1" },
    } as unknown as AuditEventInput

    try {
      createAuditEvent(unsafeInput, context)
      throw new Error("expected createAuditEvent to reject an unmanaged target type")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_target_type")
      expect((error as ValidationError).message).toBe("audit event target type is invalid")
    }
  })

  test("rejects an unmanaged outcome with a stable application error", () => {
    const unsafeInput = {
      ...makeInput(),
      outcome: "unknown",
    } as unknown as AuditEventInput

    try {
      createAuditEvent(unsafeInput, context)
      throw new Error("expected createAuditEvent to reject an unmanaged outcome")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_outcome")
      expect((error as ValidationError).message).toBe("audit event outcome is invalid")
    }
  })

  test("rejects a non-UUID request ID with a stable application error", () => {
    const unsafeContext = {
      ...context,
      requestId: "external-request-7",
    } as RequestAuditContext

    try {
      createAuditEvent(makeInput(), unsafeContext)
      throw new Error("expected createAuditEvent to reject a non-UUID request ID")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_context")
      expect((error as ValidationError).message).toBe("audit request context is invalid")
    }
  })

  test("rejects an unmanaged client name with a stable application error", () => {
    const unsafeContext = {
      ...context,
      clientName: "browser",
    } as unknown as RequestAuditContext

    try {
      createAuditEvent(makeInput(), unsafeContext)
      throw new Error("expected createAuditEvent to reject an unmanaged client name")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_context")
      expect((error as ValidationError).message).toBe("audit request context is invalid")
    }
  })

  test.each([
    ["an undefined client IP", { clientIp: undefined }],
    ["a non-string external request ID", { externalRequestId: 42 }],
  ])("rejects %s in request context without copying it to the record", (_name, overrides) => {
    const unsafeContext = { ...context, ...overrides } as unknown as RequestAuditContext

    try {
      createAuditEvent(makeInput(), unsafeContext)
      throw new Error("expected createAuditEvent to reject an invalid request context")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_context")
      expect((error as ValidationError).message).toBe("audit request context is invalid")
    }
  })

  test("keeps the numeric persistence Account ID across the opaque Domain boundary", () => {
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

  test("rejects a Date whose timestamp becomes invalid during parsing", () => {
    class StatefulDate extends Date {
      private reads = 0

      override getTime(): number {
        this.reads += 1
        return this.reads === 1 ? 1_000 : Number.NaN
      }
    }

    try {
      createAuditEvent(makeInput({ now: new StatefulDate(1_000) }), context)
      throw new Error("expected createAuditEvent to reject an unstable date")
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).code).toBe("audit_invalid_timestamp")
      expect((error as ValidationError).message).toBe("audit event time is invalid")
    }
  })
})
