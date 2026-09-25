import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  dependentObjects,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0329_convert_business_leaf_primary_keys_to_uuid.sql"

const TABLES = [
  "commendations",
  "disciplinary_actions",
  "work_accidents",
  "health_checkups",
  "it_incidents",
  "headcount_plans",
  "employee_work_styles",
  "salary_revisions",
  "company_calendar_days",
  "document_ledger_entries",
] as const

function seed(database: Database) {
  database.run("PRAGMA foreign_keys = OFF")
  database.run(
    `INSERT INTO commendations (id, employee_id, title, reason, awarded_on, created_at) VALUES
       (7, 'E001', 'MVP', 'reason', '2026-01-01', '2026-01-01T00:00:00Z'),
       (12, 'E002', 'Award', 'reason', '2026-02-01', '2026-02-01T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO company_calendar_days (id, calendar_date, kind, name, created_at) VALUES
       (3, '2026-08-13', 'holiday', 'summer', '2026-01-05T00:00:00Z')`,
  )
}

test("整数の主キーを UUID に置き換え、旧主キーを legacy_id に残す", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const before = Object.fromEntries(
      TABLES.map((table) => [table, dependentObjects(database, table)]),
    )

    // fixture は社員台帳を用意しないため、社員への外部キー違反は移行前から同じだけある。
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length

    applyMigration(database, TARGET)

    const commendations = database
      .query<{ id: string; legacy_id: string; title: string }, []>(
        "SELECT id, legacy_id, title FROM commendations ORDER BY legacy_id",
      )
      .all()
    expect(commendations.map((row) => [row.legacy_id, row.title])).toEqual([
      ["12", "Award"],
      ["7", "MVP"],
    ])
    expect(commendations.every((row) => isUuid(row.id))).toBe(true)
    expect(new Set(commendations.map((row) => row.id)).size).toBe(2)
    expect(
      database.query("SELECT legacy_id, calendar_date FROM company_calendar_days").all(),
    ).toEqual([{ legacy_id: "3", calendar_date: "2026-08-13" }])

    for (const table of TABLES) {
      const after = dependentObjects(database, table)
      const added = after.filter(
        (object) => !(before[table] ?? []).some((previous) => previous.name === object.name),
      )
      expect(after.filter((object) => added.every((extra) => extra.name !== object.name))).toEqual(
        before[table] ?? [],
      )
      expect(added.map((object) => object.name).toSorted()).toEqual(
        [`${table}_identity_update`, `${table}_legacy_id_insert`].toSorted(),
      )
    }
    expect(database.query("PRAGMA foreign_key_check").all()).toHaveLength(violationsBefore)
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

test("移行後は主キーと legacy_id を書き換えられず、新しい行は legacy_id を持てない", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    applyMigration(database, TARGET)

    expect(() =>
      database.run(
        `INSERT INTO commendations (id, employee_id, title, reason, awarded_on, created_at)
         VALUES (99, 'E001', 'x', 'y', '2026-01-01', '2026-01-01T00:00:00Z')`,
      ),
    ).toThrow("CHECK constraint failed")
    expect(() =>
      database.run(
        `INSERT INTO commendations (id, employee_id, title, reason, awarded_on, created_at, legacy_id)
         VALUES ('${crypto.randomUUID()}', 'E001', 'x', 'y', '2026-01-01', '2026-01-01T00:00:00Z', '99')`,
      ),
    ).toThrow("record_legacy_id_immutable")
    expect(() =>
      database.run("UPDATE commendations SET legacy_id = '8' WHERE legacy_id = '7'"),
    ).toThrow("record_identity_immutable")
    expect(() =>
      database.run(`UPDATE commendations SET id = '${crypto.randomUUID()}' WHERE legacy_id = '7'`),
    ).toThrow("record_identity_immutable")
    database.run(
      `INSERT INTO commendations (id, employee_id, title, reason, awarded_on, created_at)
       VALUES ('${crypto.randomUUID()}', 'E001', 'new', 'y', '2026-03-01', '2026-03-01T00:00:00Z')`,
    )
    database.run("UPDATE commendations SET title = 'renamed' WHERE legacy_id = '7'")
    expect(database.query("SELECT legacy_id FROM commendations WHERE title = 'new'").all()).toEqual(
      [{ legacy_id: null }],
    )
  } finally {
    database.close()
  }
})

test("撤去の停止中の業務があれば止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'document', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
