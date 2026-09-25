import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  dependentObjects,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0332_convert_performance_review_primary_keys_to_uuid.sql"

const LEGACY_TABLES = [
  "review_cycles",
  "review_forms",
  "evaluation_templates",
  "evaluation_sheets",
  "evaluation_sheet_audit_logs",
  "performance_goals",
  "goal_evaluations",
] as const

function seed(database: Database) {
  database.run("PRAGMA foreign_keys = OFF")
  database.run(
    `INSERT INTO review_cycles (id, title, period, status) VALUES (3, 'H1', '2026-H1', 'open')`,
  )
  database.run(`INSERT INTO review_cycle_policies (cycle_id, policy_json) VALUES (3, '{}')`)
  database.run(
    `INSERT INTO evaluation_templates (id, title, period, items, created_by, created_at, updated_at)
     VALUES (8, 't', '2026-H1', '[]', 'E001', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO evaluation_sheets (id, employee_id, template_id, period, primary_evaluator_id, created_at, updated_at)
     VALUES (11, 'E002', 8, '2026-H1', 'E001', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO evaluation_sheet_audit_logs (id, sheet_id, actor_id, action, created_at)
     VALUES (1, 11, 'E001', 'created', '2026-01-02T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO performance_goals (id, employee_id, period, title, weight, status, parent_goal_id, evaluation_sheet_id) VALUES
       (20, 'E002', '2026-H1', 'parent', 50, 'draft', NULL, 11),
       (21, 'E002', '2026-H1', 'child', 50, 'draft', 20, NULL)`,
  )
  database.run(
    `INSERT INTO goal_evaluations (id, goal_id, evaluator_id, kind, created_at)
     VALUES (1, 21, 'E001', 'self', '2026-01-03T00:00:00Z')`,
  )
}

function idOf(database: Database, table: string, legacyId: string): string {
  return (
    database
      .query<{ id: string }, [string]>(`SELECT id FROM ${table} WHERE legacy_id = ?1`)
      .get(legacyId)?.id ?? ""
  )
}

test("評価の主キーを UUID にし、期間の方針・シート・目標・評価の参照を追従させる", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length
    const before = Object.fromEntries(
      [...LEGACY_TABLES, "review_cycle_policies"].map((table) => [
        table,
        dependentObjects(database, table),
      ]),
    )

    applyMigration(database, TARGET)

    const cycle = idOf(database, "review_cycles", "3")
    const sheet = idOf(database, "evaluation_sheets", "11")
    const parent = idOf(database, "performance_goals", "20")
    const child = idOf(database, "performance_goals", "21")
    expect([cycle, sheet, parent, child].every(isUuid)).toBe(true)
    expect(database.query("SELECT cycle_id FROM review_cycle_policies").all()).toEqual([
      { cycle_id: cycle },
    ])
    expect(database.query("SELECT template_id FROM evaluation_sheets").get()).toEqual({
      template_id: idOf(database, "evaluation_templates", "8"),
    })
    expect(database.query("SELECT sheet_id FROM evaluation_sheet_audit_logs").get()).toEqual({
      sheet_id: sheet,
    })
    expect(
      database
        .query(
          "SELECT id, parent_goal_id, evaluation_sheet_id FROM performance_goals ORDER BY legacy_id",
        )
        .all(),
    ).toEqual([
      { id: parent, parent_goal_id: null, evaluation_sheet_id: sheet },
      { id: child, parent_goal_id: parent, evaluation_sheet_id: null },
    ])
    expect(database.query("SELECT goal_id FROM goal_evaluations").get()).toEqual({
      goal_id: child,
    })
    expect(() =>
      database.run(`INSERT INTO review_cycle_policies (cycle_id, policy_json) VALUES ('7', '{}')`),
    ).toThrow("CHECK constraint failed")

    for (const table of LEGACY_TABLES) {
      expect(
        dependentObjects(database, table)
          .map((object) => object.name)
          .toSorted(),
      ).toEqual(
        [
          ...(before[table] ?? []).map((object) => object.name),
          `${table}_identity_update`,
          `${table}_legacy_id_insert`,
        ].toSorted(),
      )
    }
    expect(dependentObjects(database, "review_cycle_policies")).toEqual(
      before["review_cycle_policies"] ?? [],
    )
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

test("評価期間を持たない方針があれば止める", () => {
  const database = databaseBefore(TARGET)
  try {
    database.run("PRAGMA foreign_keys = OFF")
    database.run(`INSERT INTO review_cycle_policies (cycle_id, policy_json) VALUES (9, '{}')`)

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})

test("撤去の停止中なら止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'performance-review', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
