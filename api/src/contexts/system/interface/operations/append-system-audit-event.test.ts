import { describe, expect, test } from "bun:test"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { appendSystemAuditEvent } from "@system/interface/operations/append-system-audit-event"
import { prepareSystemAuditEventAppend } from "@system/interface/operations/prepare-system-audit-event-append"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"

function auditEvent() {
  const event = SystemAuditEventEntity.create({
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
  if (event instanceof Error) throw event
  return event
}

/** bun:sqliteの互換層はbatch内のchanges()を文ごとに分けないため、不変条件文だけを成功扱いにする。 */
function isolateChangesPerBatchStatement(source: D1Database): D1Database {
  return new Proxy(source, {
    get(target, property, receiver) {
      if (property === "prepare")
        return (query: string) =>
          query.includes("changes()")
            ? source.prepare("SELECT json_extract('', '$') AS ok")
            : source.prepare(query)
      return Reflect.get(target, property, receiver)
    },
  })
}

describe("System audit event operations", () => {
  test("呼び出し側のbatchへ追加するappend文を返す", () => {
    const { context } = new SystemSessionTestContext()
    expect(
      prepareSystemAuditEventAppend({ database: context.env.DB, event: auditEvent() }),
    ).toHaveLength(2)
  })

  test("監査イベントを照合文と同じbatchで追記する", async () => {
    const { context, sqlite } = new SystemSessionTestContext()
    const database = isolateChangesPerBatchStatement(context.env.DB)
    const event = auditEvent()
    expect(await appendSystemAuditEvent({ database, event })).toBeUndefined()
    expect(
      sqlite
        .query("SELECT actor_account_id FROM system_audit_events WHERE event_id = ?1")
        .get(event.eventId),
    ).toEqual({ actor_account_id: "7" })

    const rejected = await appendSystemAuditEvent({
      database,
      event: auditEvent(),
      assertions: [database.prepare("SELECT json_extract('{}', 'changed') AS ok")],
    })
    expect(rejected).toBeInstanceOf(Error)
    expect(sqlite.query("SELECT COUNT(*) AS count FROM system_audit_events").get()).toEqual({
      count: 1,
    })
  })
})
