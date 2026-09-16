import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"

test("休暇の停止世代は4台帳の追加・更新・削除をDB確定時に拒否し、解除後に再開する", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE system_record_source_freezes (owner_context TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE leave_requests (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE leave_balances (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE leave_procedure_bindings (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE leave_decision_notifications (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  `)
  const migration = readFileSync(
    new URL("../../../../migrations/0302_guard_leave_record_source_freeze.sql", import.meta.url),
    "utf8",
  )
  database.exec(migration)
  const tables = [
    "leave_requests",
    "leave_balances",
    "leave_procedure_bindings",
    "leave_decision_notifications",
  ]
  for (const table of tables)
    database.exec(`INSERT INTO ${table} (id, value) VALUES (1, 'original')`)

  database.exec("INSERT INTO system_record_source_freezes VALUES ('asset', 1)")
  for (const table of tables) {
    database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'allowed')`)
    database.exec(`DELETE FROM ${table} WHERE id = 2`)
  }

  database.exec("INSERT INTO system_record_source_freezes VALUES ('leave', 1)")
  for (const table of tables) {
    expect(() => database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'blocked')`)).toThrow(
      "leave_record_source_frozen",
    )
    expect(() => database.exec(`UPDATE ${table} SET value = 'changed' WHERE id = 1`)).toThrow(
      "leave_record_source_frozen",
    )
    expect(() => database.exec(`DELETE FROM ${table} WHERE id = 1`)).toThrow(
      "leave_record_source_frozen",
    )
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "original",
    })
  }

  database.exec(
    "UPDATE system_record_source_freezes SET revision = 2 WHERE owner_context = 'leave'",
  )
  for (const table of tables) {
    database.exec(`UPDATE ${table} SET value = 'resumed' WHERE id = 1`)
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "resumed",
    })
  }
  database.close()
})
