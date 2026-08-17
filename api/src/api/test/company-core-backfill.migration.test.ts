import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"

const migrationsDirectory = new URL("../../../migrations/", import.meta.url)
const backfillSql = readFileSync(
  new URL("0141_company_core_backfill.sql", migrationsDirectory),
  "utf8",
)

function createPreBackfillDatabase(): Database {
  const database = new Database(":memory:")
  const schemaSql = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file < "0141_company_core_backfill.sql")
    .sort()
    .map((file) => readFileSync(new URL(file, migrationsDirectory), "utf8"))
    .join("\n")
  database.exec(schemaSql)
  return database
}

describe("0141 canonical Company backfill", () => {
  test("upgrade dataをrevision 1へ一度だけ取り込む", () => {
    const database = createPreBackfillDatabase()
    database
      .query(
        `INSERT INTO employees
           (id, code, name, dept_id, dept_name, position, status, phone,
            archived_at, archived_by_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(1, "E001", "Test Employee", null, null, null, "active", null, null, null)

    database.exec(backfillSql)

    expect(
      database
        .query("SELECT revision FROM company_organizations WHERE id = 'organization:default'")
        .get(),
    ).toEqual({ revision: 1 })
    expect(
      database
        .query(
          "SELECT resource_type, resource_id FROM company_resource_heads ORDER BY resource_type, resource_id",
        )
        .all(),
    ).toEqual([
      { resource_type: "employee", resource_id: "employee:1" },
      { resource_type: "organization-unit", resource_id: "company:root:baseline" },
      { resource_type: "person", resource_id: "person:1" },
    ])

    database.exec(backfillSql)
    expect(
      database.query("SELECT count(*) AS count FROM company_resource_revisions").get(),
    ).toEqual({
      count: 3,
    })
    expect(database.query("SELECT count(*) AS count FROM company_command_receipts").get()).toEqual({
      count: 1,
    })
  })
})
