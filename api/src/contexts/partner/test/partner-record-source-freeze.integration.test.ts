import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"

test("取引先の停止世代は2台帳の追加・更新・削除をDB確定時に拒否する", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE system_record_source_freezes (owner_context TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE partners (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE partner_contracts (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  `)
  const migration = readFileSync(
    new URL("../../../../migrations/0305_guard_partner_record_source_freeze.sql", import.meta.url),
    "utf8",
  )
  database.exec(migration)
  const tables = ["partners", "partner_contracts"]
  for (const table of tables)
    database.exec(`INSERT INTO ${table} (id, value) VALUES (1, 'original')`)
  database.exec("INSERT INTO system_record_source_freezes VALUES ('meeting', 1)")
  for (const table of tables) {
    database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'allowed')`)
    database.exec(`DELETE FROM ${table} WHERE id = 2`)
  }
  database.exec("INSERT INTO system_record_source_freezes VALUES ('partner', 1)")
  for (const table of tables) {
    expect(() => database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'blocked')`)).toThrow(
      "partner_record_source_frozen",
    )
    expect(() => database.exec(`UPDATE ${table} SET value = 'changed' WHERE id = 1`)).toThrow(
      "partner_record_source_frozen",
    )
    expect(() => database.exec(`DELETE FROM ${table} WHERE id = 1`)).toThrow(
      "partner_record_source_frozen",
    )
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "original",
    })
  }
  database.exec(
    "UPDATE system_record_source_freezes SET revision = 2 WHERE owner_context = 'partner'",
  )
  for (const table of tables) {
    database.exec(`UPDATE ${table} SET value = 'resumed' WHERE id = 1`)
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "resumed",
    })
  }
  database.close()
})
