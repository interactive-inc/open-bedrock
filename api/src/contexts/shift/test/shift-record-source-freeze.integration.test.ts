import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"

test("シフトの停止世代は3台帳の追加・更新・削除をDB確定時に拒否する", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE system_record_source_freezes (owner_context TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE shift_patterns (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE shift_assignments (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE shift_swap_requests (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  `)
  const migration = readFileSync(
    new URL("../../../../migrations/0307_guard_shift_record_source_freeze.sql", import.meta.url),
    "utf8",
  )
  database.exec(migration)
  const tables = ["shift_patterns", "shift_assignments", "shift_swap_requests"]
  for (const table of tables)
    database.exec(`INSERT INTO ${table} (id, value) VALUES (1, 'original')`)

  database.exec("INSERT INTO system_record_source_freezes VALUES ('leave', 1)")
  for (const table of tables) {
    database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'allowed')`)
    database.exec(`DELETE FROM ${table} WHERE id = 2`)
  }

  database.exec("INSERT INTO system_record_source_freezes VALUES ('shift', 1)")
  for (const table of tables) {
    expect(() => database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'blocked')`)).toThrow(
      "shift_record_source_frozen",
    )
    expect(() => database.exec(`UPDATE ${table} SET value = 'changed' WHERE id = 1`)).toThrow(
      "shift_record_source_frozen",
    )
    expect(() => database.exec(`DELETE FROM ${table} WHERE id = 1`)).toThrow(
      "shift_record_source_frozen",
    )
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "original",
    })
  }
  database.exec(
    "UPDATE system_record_source_freezes SET revision = 2 WHERE owner_context = 'shift'",
  )
  for (const table of tables) {
    database.exec(`UPDATE ${table} SET value = 'resumed' WHERE id = 1`)
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "resumed",
    })
  }
  database.close()
})
