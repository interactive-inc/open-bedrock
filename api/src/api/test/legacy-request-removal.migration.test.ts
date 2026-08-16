import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"

const migration = readFileSync(
  new URL("../../../migrations/0136_remove_legacy_request_model.sql", import.meta.url),
  "utf8",
)

const legacyTables = [
  "application_workflow_approvals",
  "application_workflow_events",
  "application_workflow_step_candidates",
  "application_workflow_step_snapshots",
  "application_workflow_instances",
  "application_workflow_revisions",
  "application_workflows",
  "approval_delegations",
  "application_approvals",
  "application_subjects",
  "application_completion_bindings",
  "application_requests",
  "application_templates",
] as const

function createDatabase(): Database {
  const database = new Database(":memory:")
  for (const table of legacyTables) {
    database.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY)`)
  }
  database.exec(`
    CREATE TABLE personnel_action_requests (
      id TEXT PRIMARY KEY,
      system_proposal_series_id TEXT,
      payload_fingerprint TEXT
    )
  `)
  return database
}

function applyMigration(database: Database): void {
  for (const statement of migration.split(";")) {
    if (statement.trim().length > 0) database.exec(statement)
  }
}

describe("legacy request removal migration", () => {
  test("runtime dataがなければ旧request modelをすべて削除する", () => {
    const database = createDatabase()

    applyMigration(database)

    const remaining = database
      .query(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name LIKE 'application_%'
         ORDER BY name`,
      )
      .all()
    expect(remaining).toEqual([])
    expect(
      database.query("SELECT name FROM sqlite_master WHERE name = 'approval_delegations'").get(),
    ).toBeNull()
    database.close()
  })

  test("digestを安全に再構成できない旧runtime dataがあれば何も削除しない", () => {
    const database = createDatabase()
    database.exec("INSERT INTO application_requests (id) VALUES (1)")

    expect(() => applyMigration(database)).toThrow()

    expect(database.query("SELECT id FROM application_requests").all()).toEqual([{ id: 1 }])
    for (const table of legacyTables) {
      expect(
        database
          .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get(table),
      ).toEqual({ name: table })
    }
    database.close()
  })

  test("Company人事申請にSystem対応が欠けていれば何も削除しない", () => {
    const database = createDatabase()
    database.exec(
      "INSERT INTO personnel_action_requests (id, system_proposal_series_id, payload_fingerprint) VALUES ('request-1', NULL, NULL)",
    )

    expect(() => applyMigration(database)).toThrow()

    expect(database.query("SELECT count(*) AS count FROM application_templates").get()).toEqual({
      count: 0,
    })
    expect(
      database.query("SELECT name FROM sqlite_master WHERE name = 'application_templates'").get(),
    ).toEqual({ name: "application_templates" })
    database.close()
  })
})
