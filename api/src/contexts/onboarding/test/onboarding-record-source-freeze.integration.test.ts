import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"

test("入退社手続きの停止世代は5台帳の追加・更新・削除をDB確定時に拒否する", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE system_record_source_freezes (owner_context TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE onboarding_templates (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE onboarding_template_tasks (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE onboarding_assignments (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE onboarding_tasks (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE onboarding_lifecycle_deliveries (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  `)
  const migration = readFileSync(
    new URL(
      "../../../../migrations/0310_guard_onboarding_record_source_freeze.sql",
      import.meta.url,
    ),
    "utf8",
  )
  database.exec(migration)
  const tables = [
    "onboarding_templates",
    "onboarding_template_tasks",
    "onboarding_assignments",
    "onboarding_tasks",
    "onboarding_lifecycle_deliveries",
  ]
  for (const table of tables)
    database.exec(`INSERT INTO ${table} (id, value) VALUES (1, 'original')`)
  database.exec("INSERT INTO system_record_source_freezes VALUES ('meeting', 1)")
  for (const table of tables) {
    database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'allowed')`)
    database.exec(`DELETE FROM ${table} WHERE id = 2`)
  }
  database.exec("INSERT INTO system_record_source_freezes VALUES ('onboarding', 1)")
  for (const table of tables) {
    expect(() => database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'blocked')`)).toThrow(
      "onboarding_record_source_frozen",
    )
    expect(() => database.exec(`UPDATE ${table} SET value = 'changed' WHERE id = 1`)).toThrow(
      "onboarding_record_source_frozen",
    )
    expect(() => database.exec(`DELETE FROM ${table} WHERE id = 1`)).toThrow(
      "onboarding_record_source_frozen",
    )
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "original",
    })
  }
  database.exec(
    "UPDATE system_record_source_freezes SET revision = 2 WHERE owner_context = 'onboarding'",
  )
  for (const table of tables) {
    database.exec(`UPDATE ${table} SET value = 'resumed' WHERE id = 1`)
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "resumed",
    })
  }
  database.close()
})
