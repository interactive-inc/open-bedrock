import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"

test("等級原記録の保全migrationはCompanyの可搬schemaと同じ表・不変triggerを作る", () => {
  const portable = readFileSync(
    new URL("../../src/contexts/company/infrastructure/schema/company.sql", import.meta.url),
    "utf8",
  )
  const start = portable.indexOf("CREATE TABLE company_grade_award_archives")
  const end =
    portable.indexOf(
      "\nEND;",
      portable.indexOf("CREATE TRIGGER company_grade_award_archive_no_delete"),
    ) + 5
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  const migrations = [
    "0192_create_company_grade_award_archives.sql",
    "0193_guard_company_grade_award_archive_update.sql",
    "0194_guard_company_grade_award_archive_delete.sql",
  ]
    .map((name) => readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8"))
    .join("\n")
  const databases = [new Database(":memory:"), new Database(":memory:")]
  try {
    databases[0].exec(portable.slice(start, end))
    databases[1].exec(migrations)
    const query =
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
    expect(databases[1].query(query).all()).toEqual(databases[0].query(query).all())
    expect(databases[1].query(query).all()).toHaveLength(3)
  } finally {
    for (const database of databases) database.close()
  }
})
