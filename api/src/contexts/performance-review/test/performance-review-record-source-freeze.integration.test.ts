import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"
import { performanceReviewRecordKinds } from "@/contexts/performance-review/domain/definitions/performance-review-record-kind.definition"
import { performanceReviewSourceTables } from "@/contexts/performance-review/infrastructure/adapters/lib/performance-review-snapshot-query"

test("人事評価の停止世代は8台帳の追加・更新・削除をDB確定時に拒否する", () => {
  const database = new Database(":memory:")
  database.exec(
    "CREATE TABLE system_record_source_freezes (owner_context TEXT NOT NULL, revision INTEGER NOT NULL)",
  )
  const tables = performanceReviewRecordKinds.map(
    (kind) => performanceReviewSourceTables[kind].table,
  )
  for (const table of tables)
    database.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, value TEXT NOT NULL)`)
  const migration = readFileSync(
    new URL(
      "../../../../migrations/0311_guard_performance_review_record_source_freeze.sql",
      import.meta.url,
    ),
    "utf8",
  )
  database.exec(migration)
  for (const table of tables) database.exec(`INSERT INTO ${table} VALUES (1,'original')`)
  database.exec("INSERT INTO system_record_source_freezes VALUES ('meeting',1)")
  for (const table of tables) {
    database.exec(`INSERT INTO ${table} VALUES (2,'allowed')`)
    database.exec(`DELETE FROM ${table} WHERE id=2`)
  }
  database.exec("INSERT INTO system_record_source_freezes VALUES ('performance-review',1)")
  for (const table of tables) {
    expect(() => database.exec(`INSERT INTO ${table} VALUES (2,'blocked')`)).toThrow(
      "performance_review_record_source_frozen",
    )
    expect(() => database.exec(`UPDATE ${table} SET value='changed' WHERE id=1`)).toThrow(
      "performance_review_record_source_frozen",
    )
    expect(() => database.exec(`DELETE FROM ${table} WHERE id=1`)).toThrow(
      "performance_review_record_source_frozen",
    )
    expect(database.query(`SELECT value FROM ${table} WHERE id=1`).get()).toEqual({
      value: "original",
    })
  }
  database.exec(
    "UPDATE system_record_source_freezes SET revision=2 WHERE owner_context='performance-review'",
  )
  for (const table of tables) database.exec(`UPDATE ${table} SET value='resumed' WHERE id=1`)
  database.close()
})
