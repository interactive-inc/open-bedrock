import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"

const companySql = readFileSync(new URL("./company.sql", import.meta.url), "utf8")

describe("canonical Company SQL", () => {
  test("resource revisionとcommand replayをDBでもfail closedにする", () => {
    const database = new Database(":memory:")
    database.exec("PRAGMA foreign_keys = ON")
    database.exec(companySql)
    database.exec(
      `INSERT INTO company_organizations (id, revision, created_at, updated_at)
       VALUES ('organization:1', 0, 1, 1)`,
    )

    expect(() =>
      database.exec(
        `INSERT INTO company_command_receipts
           (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
         VALUES ('organization:1', 'command:1', '${"a".repeat(64)}', 1, 2, 1)`,
      ),
    ).toThrow("company_revision_conflict")
  })
})
