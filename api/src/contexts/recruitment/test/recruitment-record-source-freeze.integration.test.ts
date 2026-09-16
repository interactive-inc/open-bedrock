import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"

test("採用の停止世代は2台帳の追加・更新・削除をDB確定時に拒否する", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE system_record_source_freezes (owner_context TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE job_openings (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE recruitment_candidates (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  `)
  const migration = readFileSync(
    new URL(
      "../../../../migrations/0308_guard_recruitment_record_source_freeze.sql",
      import.meta.url,
    ),
    "utf8",
  )
  database.exec(migration)
  const tables = ["job_openings", "recruitment_candidates"]
  for (const table of tables)
    database.exec(`INSERT INTO ${table} (id, value) VALUES (1, 'original')`)
  database.exec("INSERT INTO system_record_source_freezes VALUES ('meeting', 1)")
  for (const table of tables) {
    database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'allowed')`)
    database.exec(`DELETE FROM ${table} WHERE id = 2`)
  }
  database.exec("INSERT INTO system_record_source_freezes VALUES ('recruitment', 1)")
  for (const table of tables) {
    expect(() => database.exec(`INSERT INTO ${table} (id, value) VALUES (2, 'blocked')`)).toThrow(
      "recruitment_record_source_frozen",
    )
    expect(() => database.exec(`UPDATE ${table} SET value = 'changed' WHERE id = 1`)).toThrow(
      "recruitment_record_source_frozen",
    )
    expect(() => database.exec(`DELETE FROM ${table} WHERE id = 1`)).toThrow(
      "recruitment_record_source_frozen",
    )
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "original",
    })
  }
  database.exec(
    "UPDATE system_record_source_freezes SET revision = 2 WHERE owner_context = 'recruitment'",
  )
  for (const table of tables) {
    database.exec(`UPDATE ${table} SET value = 'resumed' WHERE id = 1`)
    expect(database.query(`SELECT value FROM ${table} WHERE id = 1`).get()).toEqual({
      value: "resumed",
    })
  }
  database.close()
})
