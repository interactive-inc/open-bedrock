import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const migrationSql = readFileSync(
  join(import.meta.dir, "../../../../../../migrations/0125_audit_employee_contexts.sql"),
  "utf8",
)

function createLegacyDatabase(): Database {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      request_id TEXT NOT NULL,
      actor_account_id INTEGER,
      actor_employee_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
      reason_code TEXT,
      authorization_json TEXT,
      before_json TEXT,
      after_json TEXT,
      metadata_json TEXT,
      client_ip TEXT,
      client_name TEXT NOT NULL CHECK (client_name IN ('web', 'cli', 'api', 'system')),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE audit_logs_append_guard (
      audit_id INTEGER NOT NULL UNIQUE,
      event_id TEXT NOT NULL PRIMARY KEY
    ) WITHOUT ROWID;
    INSERT INTO audit_events (
      id, event_id, request_id, actor_account_id, actor_employee_id, action, target_type,
      target_id, outcome, reason_code, authorization_json, before_json, after_json,
      metadata_json, client_ip, client_name, created_at
    ) VALUES
      (10, 'employee-event', 'request-1', 5, 50, 'legacy.employee', 'employee', '50',
       'succeeded', NULL, '{}', NULL, NULL, '{"source":"legacy"}', '192.0.2.1', 'api', 100),
      (11, 'account-event', 'request-2', 6, NULL, 'legacy.account', 'account', '6',
       'denied', 'blocked', NULL, NULL, NULL, NULL, NULL, 'system', 200);
    INSERT INTO audit_logs_append_guard (audit_id, event_id)
    VALUES (10, 'employee-event'), (11, 'account-event');
  `)
  return database
}

describe("0125 audit employee contexts", () => {
  test("preserves events and moves the Company actor to an immutable satellite", () => {
    const database = createLegacyDatabase()
    database.exec(migrationSql)

    const columns = database
      .query<{ name: string }, []>("PRAGMA table_info(audit_events)")
      .all()
      .map((column) => column.name)
    const publicRows = database
      .query(
        `SELECT event_id, actor_account_id, actor_employee_id, action, outcome, metadata_json
         FROM company_audit_events ORDER BY id`,
      )
      .all()
    const contexts = database
      .query("SELECT audit_event_id, employee_id FROM audit_event_employee_contexts")
      .all()

    expect(columns).not.toContain("actor_employee_id")
    expect(publicRows).toEqual([
      {
        event_id: "employee-event",
        actor_account_id: 5,
        actor_employee_id: 50,
        action: "legacy.employee",
        outcome: "succeeded",
        metadata_json: '{"source":"legacy"}',
      },
      {
        event_id: "account-event",
        actor_account_id: 6,
        actor_employee_id: null,
        action: "legacy.account",
        outcome: "denied",
        metadata_json: null,
      },
    ])
    expect(contexts).toEqual([{ audit_event_id: 10, employee_id: 50 }])

    expect(() => database.run("UPDATE audit_events SET action = 'changed' WHERE id = 10")).toThrow()
    expect(() =>
      database.run(
        "UPDATE audit_event_employee_contexts SET employee_id = 51 WHERE audit_event_id = 10",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "INSERT INTO audit_event_employee_contexts (audit_event_id, employee_id) VALUES (999, 99)",
      ),
    ).toThrow()

    database.close()
  })

  test("dispatches Company appends atomically and keeps the staging table empty", () => {
    const database = createLegacyDatabase()
    database.exec(migrationSql)

    database.run(
      `INSERT INTO company_audit_event_appends (
         event_id, request_id, actor_account_id, actor_employee_id, action, target_type,
         target_id, outcome, reason_code, authorization_json, before_json, after_json,
         metadata_json, client_ip, client_name, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "new-event",
        "request-3",
        7,
        70,
        "iam.role.updated",
        "role",
        "manager",
        "succeeded",
        null,
        null,
        null,
        null,
        null,
        null,
        "api",
        300,
      ],
    )
    const topLevelChanges = database.query("SELECT changes() AS total").get() as { total: number }

    const inserted = database
      .query(
        `SELECT event_id, actor_account_id, actor_employee_id
         FROM company_audit_events WHERE event_id = 'new-event'`,
      )
      .get()
    const stagingCount = database
      .query("SELECT COUNT(*) AS total FROM company_audit_event_appends")
      .get() as { total: number }

    expect(topLevelChanges.total).toBe(1)
    expect(inserted).toEqual({
      event_id: "new-event",
      actor_account_id: 7,
      actor_employee_id: 70,
    })
    expect(stagingCount.total).toBe(0)
    expect(() =>
      database.run(
        `INSERT INTO company_audit_event_appends (
           event_id, request_id, actor_account_id, action, outcome, client_name, created_at
         ) VALUES ('new-event', 'request-4', 7, 'iam.role.updated', 'succeeded', 'api', 400)`,
      ),
    ).toThrow()

    database.close()
  })
})
