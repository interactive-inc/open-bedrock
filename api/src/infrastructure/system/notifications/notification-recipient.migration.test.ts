import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const migrationSql = readFileSync(
  join(import.meta.dir, "../../../../migrations/0124_notification_account_recipients.sql"),
  "utf8",
)

function createLegacyDatabase(): Database {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE account_employee_links (
      account_id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL UNIQUE
    );
    CREATE TABLE notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_employee_id INTEGER NOT NULL,
      source_domain TEXT NOT NULL,
      source_id INTEGER,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_notifications_recipient_unread
      ON notifications (recipient_employee_id) WHERE is_read = 0;
  `)
  return database
}

function applyMigration(database: Database): void {
  database.transaction(() => {
    for (const statement of migrationSql.split(";")) {
      if (statement.trim().length > 0) {
        database.run(statement)
      }
    }
  })()
}

describe("0124 notification account recipients", () => {
  test("preserves every notification while translating Employee recipients to Accounts", () => {
    const database = createLegacyDatabase()
    database.exec(`
      INSERT INTO account_employee_links (account_id, employee_id) VALUES (101, 11), (202, 22);
      INSERT INTO notifications (
        id, recipient_employee_id, source_domain, source_id, kind, title, body, is_read, created_at
      ) VALUES
        (7, 11, 'approval', 31, 'approval_result', 'Approved', NULL, 0, '2026-01-01T00:00:00Z'),
        (9, 22, 'manual', NULL, 'task', 'Task', 'Body', 1, '2026-01-02T00:00:00Z');
    `)

    applyMigration(database)

    const columns = database
      .query<{ name: string }, []>("PRAGMA table_info(notifications)")
      .all()
      .map((column) => column.name)
    const notifications = database
      .query(
        `SELECT id, recipient_account_id, source_domain, source_id, kind, title, body, is_read, created_at
         FROM notifications ORDER BY id`,
      )
      .all()

    expect(columns).toContain("recipient_account_id")
    expect(columns).not.toContain("recipient_employee_id")
    expect(notifications).toEqual([
      {
        id: 7,
        recipient_account_id: 101,
        source_domain: "approval",
        source_id: 31,
        kind: "approval_result",
        title: "Approved",
        body: null,
        is_read: 0,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: 9,
        recipient_account_id: 202,
        source_domain: "manual",
        source_id: null,
        kind: "task",
        title: "Task",
        body: "Body",
        is_read: 1,
        created_at: "2026-01-02T00:00:00Z",
      },
    ])

    database.close()
  })

  test("fails closed when a legacy notification has no Account link", () => {
    const database = createLegacyDatabase()
    database.exec(`
      INSERT INTO notifications (
        recipient_employee_id, source_domain, kind, title, is_read, created_at
      ) VALUES (99, 'manual', 'task', 'Unlinked', 0, '2026-01-01T00:00:00Z');
    `)

    expect(() => applyMigration(database)).toThrow()

    const columns = database
      .query<{ name: string }, []>("PRAGMA table_info(notifications)")
      .all()
      .map((column) => column.name)

    expect(columns).toContain("recipient_employee_id")
    expect(columns).not.toContain("recipient_account_id")

    database.close()
  })
})
