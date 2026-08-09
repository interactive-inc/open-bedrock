import { createSystemAuditEvent } from "@/domain/system/audit/audit-event"
import { SystemAuditEventRepository } from "@/infrastructure/system/audit/system-audit-event-repository"
import { createTestContext } from "@/interface/test-helpers/create-test-context"
import { describe, expect, test } from "bun:test"

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
})
