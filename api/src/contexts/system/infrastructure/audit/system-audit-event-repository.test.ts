import { createSystemAuditEvent } from "@system/domain/audit/create-system-audit-event"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event.repository"
import { SystemSessionTestContext } from "@system/infrastructure/auth/system-session-test-context.test-support"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context.repository"
import { describe, expect, test } from "bun:test"

function isolateChangesPerBatchStatement(context: SystemD1Context): SystemD1Context {
  const source = context.env.DB
  return {
    env: {
      DB: new Proxy(source, {
        get(target, property, receiver) {
          if (property === "prepare") {
            return (query: string) =>
              query.includes("changes()")
                ? source.prepare("SELECT json_extract('', '$') AS ok")
                : source.prepare(query)
          }

          return Reflect.get(target, property, receiver)
        },
      }),
    },
  }
}

describe("SystemAuditEventRepository", () => {
  test("appends an Account-scoped event to the standalone System table", async () => {
    const { context, sqlite } = new SystemSessionTestContext()
    const record = createSystemAuditEvent({
      actorAccountId: "7",
      action: "auth.session.logout",
      targetType: "account",
      targetId: "7",
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: new Date("2026-01-01T00:00:00.123Z"),
    })
    if (record instanceof Error) throw record
    const isolatedContext = isolateChangesPerBatchStatement(context)

    expect(await new SystemAuditEventRepository(isolatedContext).append(record)).toBeUndefined()

    const stored = sqlite
      .query(
        `SELECT event_id, actor_account_id, occurred_at
         FROM system_audit_events
         WHERE event_id = ?1`,
      )
      .get(record.eventId)

    expect(stored).toEqual({
      event_id: record.eventId,
      actor_account_id: "7",
      occurred_at: Date.parse("2026-01-01T00:00:00.123Z"),
    })

    expect(sqlite.query("SELECT COUNT(*) AS count FROM system_audit_events").get()).toEqual({
      count: 1,
    })
  })

  test("fails closed when the audit insert is silently ignored", async () => {
    const { context, sqlite } = new SystemSessionTestContext()
    const record = createSystemAuditEvent({
      actorAccountId: "7",
      action: "auth.session.logout",
      targetType: "account",
      targetId: "7",
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    })
    if (record instanceof Error) throw record
    sqlite.exec(`
      CREATE TRIGGER ignore_system_audit_insert
      BEFORE INSERT ON system_audit_events
      WHEN NEW.event_id = '${record.eventId}'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)

    expect(await new SystemAuditEventRepository(context).append(record)).toBeInstanceOf(Error)
    expect(
      sqlite
        .query("SELECT COUNT(*) AS count FROM system_audit_events WHERE event_id = ?1")
        .get(record.eventId),
    ).toEqual({ count: 0 })
  })
})
