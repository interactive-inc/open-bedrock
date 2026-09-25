import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { executeSql } from "../../scripts/sql-statements"
import { createSqliteDatabaseBeforeMigration } from "@tests/api/support/migrated-sqlite-database"

const MIGRATIONS_ROOT = resolve(import.meta.dir, "..", "..", "migrations")
const TARGET = "0326_decouple_business_context_references.sql"

function triggerNames(database: Database, table: string): string[] {
  return database
    .query<{ name: string }, [string]>(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name = ?1 ORDER BY name",
    )
    .all(table)
    .map((row) => row.name)
}

test("業務間の列名参照の改名は行と値と保全triggerを保持する", () => {
  const database = createSqliteDatabaseBeforeMigration(TARGET)
  try {
    // 従業員台帳の用意は検査対象外のため、改名前後の値だけを見る。
    database.query("PRAGMA foreign_keys = OFF").run()
    database
      .query(
        `INSERT INTO one_on_ones (id, member_id, manager_id, held_at, evaluation_sheet_id)
        VALUES ('00000000-0000-4000-8000-000000000001', 'E001', 'E002', '2026-01-01T00:00:00Z', 7)`,
      )
      .run()
    database
      .query(
        `INSERT INTO document_ledger_entries (id, title, location, partner_code, created_at)
        VALUES (1, 'contract', 'cabinet', 'P0001', '2026-01-01T00:00:00Z')`,
      )
      .run()
    const oneOnOneTriggers = triggerNames(database, "one_on_ones")
    const documentTriggers = triggerNames(database, "document_ledger_entries")

    executeSql(database, readFileSync(resolve(MIGRATIONS_ROOT, TARGET), "utf8"), TARGET)

    expect(database.query("SELECT external_reference FROM one_on_ones").all()).toEqual([
      { external_reference: 7 },
    ])
    expect(
      database.query("SELECT counterparty_reference FROM document_ledger_entries").all(),
    ).toEqual([{ counterparty_reference: "P0001" }])
    expect(triggerNames(database, "one_on_ones")).toEqual(oneOnOneTriggers)
    expect(triggerNames(database, "document_ledger_entries")).toEqual(documentTriggers)
  } finally {
    database.close()
  }
})
