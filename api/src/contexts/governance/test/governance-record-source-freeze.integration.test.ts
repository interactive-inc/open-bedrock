import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"
import { governanceRecordKinds } from "@/contexts/governance/domain/definitions/governance-record-kind.definition"
import { governanceSourceTables } from "@/contexts/governance/infrastructure/adapters/lib/governance-snapshot-query"

test("規程の既存停止世代を拡張し、8台帳の追加・更新・削除をDB確定時に拒否する", () => {
  const database = new Database(":memory:")
  database.exec(
    "CREATE TABLE system_record_source_freezes (owner_context TEXT NOT NULL, revision INTEGER NOT NULL)",
  )
  const tables = governanceRecordKinds.map((kind) => governanceSourceTables[kind].table)
  for (const table of tables)
    database.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, value TEXT NOT NULL)`)
  for (const migration of [
    "0299_guard_governance_responsibility_source_freeze.sql",
    "0312_guard_governance_record_source_freeze.sql",
  ])
    database.exec(
      readFileSync(new URL(`../../../../migrations/${migration}`, import.meta.url), "utf8"),
    )
  for (const table of tables) database.exec(`INSERT INTO ${table} VALUES (1,'original')`)
  database.exec("INSERT INTO system_record_source_freezes VALUES ('meeting',1)")
  for (const table of tables) {
    database.exec(`INSERT INTO ${table} VALUES (2,'allowed')`)
    database.exec(`DELETE FROM ${table} WHERE id=2`)
  }
  database.exec("INSERT INTO system_record_source_freezes VALUES ('governance',1)")
  for (const table of tables) {
    const message =
      table === "governance_org_role_assignments"
        ? "governance_org_role_assignment_source_frozen"
        : "governance_record_source_frozen"
    expect(() => database.exec(`INSERT INTO ${table} VALUES (2,'blocked')`)).toThrow(message)
    expect(() => database.exec(`UPDATE ${table} SET value='changed' WHERE id=1`)).toThrow(message)
    expect(() => database.exec(`DELETE FROM ${table} WHERE id=1`)).toThrow(message)
    expect(database.query(`SELECT value FROM ${table} WHERE id=1`).get()).toEqual({
      value: "original",
    })
  }
  database.exec(
    "UPDATE system_record_source_freezes SET revision=2 WHERE owner_context='governance'",
  )
  for (const table of tables) database.exec(`UPDATE ${table} SET value='resumed' WHERE id=1`)
  database.close()
})
