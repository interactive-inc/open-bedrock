import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"

test("等級原記録の保全migrationと主キー・組織 ID の作り直しはCompanyの可搬schemaと同じ表・不変triggerを作る", () => {
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
    // 主キーを UUID へ移す migration のうち、この table を作り直す文だけを同じ順に当てる。
    for (const statement of splitSqlStatements(
      readFileSync(
        new URL(
          "../../migrations/0340_enforce_company_record_uuid_primary_keys.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ).filter(
      (statement) =>
        statement.includes("company_grade_award_archives") &&
        !statement.includes("_company_record_uuid_primary_key_validation"),
    ))
      databases[1].run(statement)
    // 組織の ID を UUID へ移す migration も、この table を作り直す文だけを当てる。組織の対応表は空で足りる。
    databases[1].run(
      "CREATE TABLE _company_organizations_id_map (old_id TEXT PRIMARY KEY, new_id TEXT)",
    )
    for (const statement of splitSqlStatements(
      readFileSync(
        new URL(
          "../../migrations/0341_convert_company_organization_ids_to_uuid.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ).filter(
      (statement) =>
        statement.includes("company_grade_award_archives") &&
        !statement.includes("_company_organization_uuid_validation") &&
        !statement.includes("_uuid_reference_orphans"),
    ))
      databases[1].run(statement)
    databases[1].run("DROP TABLE _company_organizations_id_map")
    const query =
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
    expect(databases[1].query(query).all()).toEqual(databases[0].query(query).all())
    expect(databases[1].query(query).all()).toHaveLength(4)
  } finally {
    for (const database of databases) database.close()
  }
})
