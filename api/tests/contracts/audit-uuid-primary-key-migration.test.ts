import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0337_rebuild_audit_tables_with_uuid_primary_keys.sql"
const AUDIT_TABLES = [
  "system_audit_events",
  "company_audit_events",
  "company_audit_event_appends",
  "company_audit_event_employee_contexts",
  "company_audit_append_guard",
  "company_audit_batch_decisions",
  "system_audit_disclosure_policy_revisions",
] as const

test("監査の記録を空の UUID 主キーの table で作り直し、追記の経路を保つ", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_audit_events",
      `INSERT INTO system_audit_events (event_id, action, target_type, outcome, occurred_at)
       VALUES ('canonical-company-id:1', 'company.identity.canonicalized', 'employee', 'succeeded', 0)`,
    )
    const triggersBefore = database
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name IN (${AUDIT_TABLES.map((t) => `'${t}'`).join(",")}) ORDER BY name`,
      )
      .all()

    applyMigration(database, TARGET)

    for (const table of AUDIT_TABLES)
      expect({ table, rows: database.query(`SELECT count(*) AS n FROM ${table}`).get() }).toEqual({
        table,
        rows: { n: 0 },
      })
    expect(
      database
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name IN (${AUDIT_TABLES.map((t) => `'${t}'`).join(",")}) ORDER BY name`,
        )
        .all(),
    ).toEqual(triggersBefore)

    // 追記用の一時行から監査の行と社員の文脈が UUID の主キーで作られ、一時行は消える。
    const eventId = crypto.randomUUID()
    database.run(
      `INSERT INTO company_audit_event_appends
         (event_id, request_id, actor_account_id, actor_employee_id, action, outcome, client_name, created_at)
       VALUES ('${eventId}', 'request', 'account', 'E001', 'company.test', 'succeeded', 'api', 1)`,
    )
    const event = database
      .query<{ id: string }, [string]>("SELECT id FROM company_audit_events WHERE event_id = ?1")
      .get(eventId)
    expect(isUuid(event?.id)).toBe(true)
    expect(
      database
        .query("SELECT audit_event_id, employee_id FROM company_audit_event_employee_contexts")
        .get(),
    ).toEqual({ audit_event_id: event?.id, employee_id: "E001" })
    expect(
      database.query("SELECT audit_id, event_id FROM company_audit_append_guard").get(),
    ).toEqual({
      audit_id: event?.id,
      event_id: eventId,
    })
    expect(database.query("SELECT count(*) AS n FROM company_audit_event_appends").get()).toEqual({
      n: 0,
    })
    expect(
      database.query("SELECT actor_employee_id FROM company_audit_event_details").get(),
    ).toEqual({
      actor_employee_id: "E001",
    })
    expect(() => database.run("DELETE FROM company_audit_events")).toThrow("append only")
    expect(() =>
      database.run(
        `INSERT INTO system_audit_events (event_id, action, target_type, outcome, occurred_at)
         VALUES ('not-a-uuid', 'x.y.z', 'employee', 'succeeded', 0)`,
      ),
    ).toThrow("CHECK constraint failed")
    expect(
      database
        .query(
          "SELECT name FROM sqlite_master WHERE name LIKE '\\_%' ESCAPE '\\' OR name LIKE '\\_\\_new\\_%' ESCAPE '\\'",
        )
        .all(),
    ).toEqual([])
  } finally {
    database.close()
  }
})

test("監査の行を指す記録があれば消さずに止める", () => {
  const database = databaseBefore(TARGET)
  try {
    const eventId = crypto.randomUUID()
    insertBypassingGuards(
      database,
      "system_audit_events",
      `INSERT INTO system_audit_events (event_id, action, target_type, outcome, occurred_at)
       VALUES ('${eventId}', 'system.record.freeze', 'record', 'succeeded', 0)`,
    )
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'leave', 2, '${eventId}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
    expect(database.query("SELECT count(*) AS n FROM system_audit_events").get()).toEqual({ n: 1 })
  } finally {
    database.close()
  }
})
