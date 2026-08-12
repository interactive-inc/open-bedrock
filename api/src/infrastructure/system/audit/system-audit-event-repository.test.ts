import { createSystemAuditEvent } from "@/composition/audit/system-audit-event"
import { SystemAuditEventRepository } from "@system/infrastructure/audit/system-audit-event-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { describe, expect, test } from "bun:test"

function isolateChangesPerBatchStatement(context: ReturnType<typeof createTestContext>["context"]) {
  const source = context.env.DB
  context.env.DB = new Proxy(source, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (query: string) =>
          query.includes("changes()")
            ? source.prepare("SELECT json_extract('', '$') AS ok")
            : source.prepare(query)
      }

      return Reflect.get(target, property, receiver)
    },
  })
}

describe("SystemAuditEventRepository", () => {
  test("appends an Account-scoped event to the standalone System table", async () => {
    const { context, db } = createTestContext()
    const record = createSystemAuditEvent(
      {
        actorAccountId: 7,
        action: "auth.session.logout",
        target: { type: "account", id: "7" },
        outcome: "succeeded",
        reasonCode: null,
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
      context.var.auditContext,
    )
    isolateChangesPerBatchStatement(context)

    expect(await new SystemAuditEventRepository(context).append(record)).toBeUndefined()

    const stored = await db
      .prepare(
        `SELECT event_id, actor_account_id
         FROM audit_events
         WHERE event_id = ?1`,
      )
      .bind(record.eventId)
      .first<Record<string, unknown>>()

    expect(stored).toEqual({
      event_id: record.eventId,
      actor_account_id: 7,
    })

    const columns = await db.prepare("PRAGMA table_info(audit_events)").all<{ name: string }>()

    expect(columns.results.map((column) => column.name)).not.toContain("actor_employee_id")
  })

  test("fails closed when the audit insert is silently ignored", async () => {
    const { context, db } = createTestContext()
    const record = createSystemAuditEvent(
      {
        actorAccountId: 7,
        action: "auth.session.logout",
        target: { type: "account", id: "7" },
        outcome: "succeeded",
        reasonCode: null,
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
      context.var.auditContext,
    )
    await db.exec(`
      CREATE TRIGGER ignore_system_audit_insert
      BEFORE INSERT ON audit_events
      WHEN NEW.event_id = '${record.eventId}'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)

    expect(await new SystemAuditEventRepository(context).append(record)).toBeInstanceOf(Error)
    expect(
      await db
        .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE event_id = ?1")
        .bind(record.eventId)
        .first<number>("count"),
    ).toBe(0)
  })
})
