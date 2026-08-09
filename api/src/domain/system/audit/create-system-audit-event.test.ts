import { createSystemAuditEvent } from "@/domain/system/audit/create-system-audit-event"
import type { SystemAuditEventInput } from "@/domain/system/audit/system-audit-event"
import { describe, expect, test } from "bun:test"

describe("createSystemAuditEvent", () => {
  test("creates an immutable storage-independent event for a string Account ID", () => {
    const event = createSystemAuditEvent({
      actorAccountId: "account-1",
      action: "auth.session.logout",
      targetType: "account",
      targetId: "account-1",
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: '{"source":"api"}',
      occurredAt: new Date("2026-01-01T00:00:00.123Z"),
    })

    expect(event).not.toBeInstanceOf(Error)
    if (event instanceof Error) return

    expect(event).toMatchObject({
      actorAccountId: "account-1",
      action: "auth.session.logout",
      targetType: "account",
      targetId: "account-1",
      outcome: "succeeded",
      metadataJson: '{"source":"api"}',
      occurredAtEpochMilliseconds: 1_767_225_600_123,
    })
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/u)
    expect(Object.isFrozen(event)).toBe(true)
  })

  test.each([7, null])("accepts numeric and anonymous Account actors: %p", (actorAccountId) => {
    const event = createSystemAuditEvent({
      actorAccountId,
      action: "auth.session.logout",
      targetType: "account",
      targetId: null,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: new Date(0),
    })

    expect(event).not.toBeInstanceOf(Error)
    if (event instanceof Error) return
    expect(event.actorAccountId).toBe(actorAccountId)
  })

  test.each([
    ["actorAccountId", true],
    ["actorAccountId", " "],
    ["actorAccountId", 0],
    ["action", "not valid"],
    ["targetType", "not valid"],
    ["targetId", ""],
    ["outcome", "unknown"],
    ["reasonCode", ""],
    ["authorizationJson", "{"],
    ["occurredAt", new Date(Number.NaN)],
  ])("fails closed for invalid %s", (property, value) => {
    const input = {
      actorAccountId: null,
      action: "auth.session.logout",
      targetType: "account",
      targetId: null,
      outcome: "failed",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: new Date(0),
    } satisfies SystemAuditEventInput
    Object.defineProperty(input, property, { value })

    expect(createSystemAuditEvent(input)).toBeInstanceOf(Error)
  })
})
