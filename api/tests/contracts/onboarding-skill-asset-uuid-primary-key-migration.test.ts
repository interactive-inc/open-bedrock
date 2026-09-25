import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  dependentObjects,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0333_convert_onboarding_skill_asset_keys_to_uuid.sql"

const LEGACY_TABLES = [
  "onboarding_templates",
  "onboarding_assignments",
  "onboarding_tasks",
] as const
const SURROGATE_TABLES = [
  "onboarding_template_tasks",
  "onboarding_lifecycle_template_bindings",
  "skill_definitions",
  "employee_skills",
  "assets",
  "stocktake_items",
] as const
const STOCKTAKE = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"

function seed(database: Database) {
  database.run("PRAGMA foreign_keys = OFF")
  database.run(
    `INSERT INTO onboarding_templates (id, code, name, kind) VALUES (1, 'join', 'Join', 'join')`,
  )
  database.run(
    `INSERT INTO onboarding_template_tasks (template_code, code, title, sort_order) VALUES ('join', 'pc', 'PC', 1)`,
  )
  database.run(
    `INSERT INTO onboarding_assignments (id, employee_id, template_code, kind, status, assigned_at)
     VALUES (100, 'E005', 'join', 'join', 'in_progress', '2026-05-29T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO onboarding_tasks (id, assignment_id, template_task_code, title, sort_order, status)
     VALUES (200, 100, 'pc', 'PC', 1, 'pending')`,
  )
  database.run(
    `INSERT INTO onboarding_lifecycle_template_bindings (effect_type, template_code, updated_at)
     VALUES ('hire', 'join', 0)`,
  )
  database.run(`INSERT INTO skill_definitions (code, name, category) VALUES ('ts', 'TS', 'lang')`)
  database.run(
    `INSERT INTO employee_skills (employee_id, skill_code, level) VALUES ('E005', 'ts', 3)`,
  )
  database.run(`INSERT INTO assets (code, name, kind, status) VALUES ('A1', 'PC', 'pc', 'stock')`)
  database.run(
    `INSERT INTO stocktakes (id, name, target_date, status, created_at)
     VALUES ('${STOCKTAKE}', 's', '2026-01-01', 'open', '2026-01-01T00:00:00Z')`,
  )
  database.run(
    `INSERT INTO stocktake_items (stocktake_id, asset_code) VALUES ('${STOCKTAKE}', 'A1')`,
  )
}

test("整数と業務コードの主キーを UUID にし、割当の参照を追従させ、業務コードを一意に残す", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length
    const before = Object.fromEntries(
      [...LEGACY_TABLES, ...SURROGATE_TABLES, "onboarding_lifecycle_deliveries"].map((table) => [
        table,
        dependentObjects(database, table),
      ]),
    )

    applyMigration(database, TARGET)

    const assignment = database
      .query<{ id: string }, []>("SELECT id FROM onboarding_assignments WHERE legacy_id = '100'")
      .get()?.id
    expect(isUuid(assignment)).toBe(true)
    expect(database.query("SELECT legacy_id, assignment_id FROM onboarding_tasks").get()).toEqual({
      legacy_id: "200",
      assignment_id: assignment,
    })
    for (const table of SURROGATE_TABLES) {
      const ids = database
        .query<{ id: string }, []>(`SELECT id FROM ${table}`)
        .all()
        .map((row) => row.id)
      expect({ table, count: ids.length, uuid: ids.every(isUuid) }).toEqual({
        table,
        count: 1,
        uuid: true,
      })
    }
    // 業務コードは主キーから外しても一意のまま残る。
    expect(() =>
      database.run(
        `INSERT INTO assets (id, code, name, kind, status) VALUES ('${crypto.randomUUID()}', 'A1', 'dup', 'pc', 'stock')`,
      ),
    ).toThrow("UNIQUE constraint failed")
    expect(() =>
      database.run(
        `INSERT INTO employee_skills (id, employee_id, skill_code, level) VALUES ('${crypto.randomUUID()}', 'E005', 'ts', 1)`,
      ),
    ).toThrow("UNIQUE constraint failed")
    expect(() =>
      database.run("UPDATE skill_definitions SET id = '" + crypto.randomUUID() + "'"),
    ).toThrow("record_identity_immutable")

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
    for (const table of SURROGATE_TABLES) {
      expect(
        dependentObjects(database, table)
          .map((object) => object.name)
          .toSorted(),
      ).toEqual(
        [
          ...(before[table] ?? []).map((object) => object.name),
          `${table}_identity_update`,
        ].toSorted(),
      )
    }
    expect(dependentObjects(database, "onboarding_lifecycle_deliveries")).toEqual(
      before["onboarding_lifecycle_deliveries"] ?? [],
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

test("撤去の停止中なら止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'skill', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
