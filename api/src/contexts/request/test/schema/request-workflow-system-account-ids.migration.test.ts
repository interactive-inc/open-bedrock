import { afterEach, describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../../../migrations")
const migrationName = "0131_request_workflow_system_account_ids.sql"
const migration = readFileSync(join(migrationsDirectory, migrationName), "utf8")
const openDatabases: Array<Database> = []

function createPreMigrationDatabase(): Database {
  const database = new Database(":memory:")
  const schema = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file < migrationName)
    .sort()
    .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
    .join("\n")

  database.exec(schema)
  database.exec("PRAGMA foreign_keys = ON")
  openDatabases.push(database)
  return database
}

function applyMigration(database: Database): void {
  const statements = migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "")

  database.transaction(() => {
    for (const statement of statements) database.exec(statement)
  })()
}

function seedWorkflowAccountHistory(database: Database): void {
  database.exec(`
    INSERT INTO accounts (id, status, token_version, created_at, updated_at) VALUES
      (1, 'active', 0, 0, 0),
      (2, 'active', 0, 0, 0);
    INSERT INTO application_workflows
      (template_id, definition_json, updated_at, revision, updated_by_account_id)
    VALUES (10, '{}', '2026-01-01T00:00:00.000Z', 1, 1);
    INSERT INTO application_workflow_revisions
      (template_id, revision, definition_json, updated_by_account_id, created_at)
    VALUES (10, 1, '{}', 1, '2026-01-01T00:00:00.000Z');
    INSERT INTO application_workflow_step_candidates
      (application_id, step_key, round, candidate_employee_id, candidate_account_id,
       source, selectors_json, resolution_id, resolved_at)
    VALUES (20, 'manager', 1, 2, 2, 'primary', '[]', 'resolution-1',
            '2026-01-01T00:00:00.000Z');
    INSERT INTO approval_delegations
      (id, delegator_employee_id, delegate_employee_id, template_code, starts_at, ends_at,
       created_by_account_id, created_at)
    VALUES (40, 2, 1, NULL, '2026-01-01T00:00:00.000Z',
            '2026-02-01T00:00:00.000Z', 1, '2026-01-01T00:00:00.000Z');
    INSERT INTO application_workflow_approvals
      (id, application_id, step_key, round, approver_id, approver_account_id,
       represented_approver_id, delegation_id, action, created_at)
    VALUES (50, 20, 'manager', 1, 1, 1, 2, 40, 'approve',
            '2026-01-02T00:00:00.000Z');
    INSERT INTO application_workflow_events
      (id, application_id, step_key, round, event_type, actor_account_id,
       occurred_at, details_json)
    VALUES (60, 20, 'manager', 1, 'reassigned', 1,
            '2026-01-02T00:00:00.000Z', '{}');
  `)
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close()
})

describe("0131 Request workflow canonical System Account IDs", () => {
  test("Wranglerのstatement分割境界をmigration内に固定する", () => {
    expect(migration.match(/--> statement-breakpoint/g)).toHaveLength(42)
    expect(
      migration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement !== ""),
    ).toHaveLength(42)
  })

  test("全actor・candidate履歴をTEXTへ変換し制約と追記専用監査を維持する", () => {
    const database = createPreMigrationDatabase()
    seedWorkflowAccountHistory(database)
    applyMigration(database)

    const storedTypes = database
      .query<{ source: string; accountId: string; storageType: string }, []>(`
        SELECT 'workflow' AS source, updated_by_account_id AS accountId,
               typeof(updated_by_account_id) AS storageType
        FROM application_workflows
        WHERE updated_by_account_id IS NOT NULL
        UNION ALL
        SELECT 'revision', updated_by_account_id, typeof(updated_by_account_id)
        FROM application_workflow_revisions
        WHERE updated_by_account_id IS NOT NULL
        UNION ALL
        SELECT 'candidate', candidate_account_id, typeof(candidate_account_id)
        FROM application_workflow_step_candidates
        UNION ALL
        SELECT 'approval', approver_account_id, typeof(approver_account_id)
        FROM application_workflow_approvals
        UNION ALL
        SELECT 'event', actor_account_id, typeof(actor_account_id)
        FROM application_workflow_events
        UNION ALL
        SELECT 'delegation', created_by_account_id, typeof(created_by_account_id)
        FROM approval_delegations
        ORDER BY source
      `)
      .all()

    expect(storedTypes).toEqual([
      { source: "approval", accountId: "1", storageType: "text" },
      { source: "candidate", accountId: "2", storageType: "text" },
      { source: "delegation", accountId: "1", storageType: "text" },
      { source: "event", accountId: "1", storageType: "text" },
      { source: "revision", accountId: "1", storageType: "text" },
      { source: "workflow", accountId: "1", storageType: "text" },
    ])
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    expect(() =>
      database.run(
        `INSERT INTO application_workflow_step_candidates
          (application_id, step_key, round, candidate_employee_id, candidate_account_id,
           source, selectors_json, resolution_id, resolved_at)
         VALUES (21, 'manager', 1, 2, 'unknown', 'primary', '[]', 'resolution-2',
                 '2026-01-01T00:00:00.000Z')`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "UPDATE application_workflow_revisions SET definition_json = '{}' WHERE template_id = 10",
      ),
    ).toThrow("application_workflow_revisions is append-only")
    expect(() =>
      database.run("DELETE FROM application_workflow_revisions WHERE template_id = 10"),
    ).toThrow("application_workflow_revisions is append-only")
    expect(
      database
        .query<{ count: number }, []>(`
          SELECT count(*) AS count FROM sqlite_master
          WHERE type = 'index' AND name IN (
            'uq_workflow_approval_actor_step',
            'idx_workflow_approval_application',
            'idx_workflow_step_candidates_employee',
            'uq_application_workflow_event_once',
            'idx_approval_delegations_delegate_period'
          )
        `)
        .get(),
    ).toEqual({ count: 5 })
  })

  test("canonical Accountが一件でも欠ける場合はschema置換前に全体をrollbackする", () => {
    const database = createPreMigrationDatabase()
    database.run(
      `INSERT INTO application_workflows
        (template_id, definition_json, updated_at, revision, updated_by_account_id)
       VALUES (10, '{}', '2026-01-01T00:00:00.000Z', 1, 999)`,
    )

    expect(() => applyMigration(database)).toThrow()
    expect(
      database
        .query<{ storageType: string }, []>(`
          SELECT typeof(updated_by_account_id) AS storageType
          FROM application_workflows WHERE template_id = 10
        `)
        .get(),
    ).toEqual({ storageType: "integer" })
    expect(
      database
        .query<{ count: number }, []>(`
          SELECT count(*) AS count FROM sqlite_master
          WHERE type = 'table' AND name LIKE '%_legacy_account_ids'
        `)
        .get(),
    ).toEqual({ count: 0 })
  })

  test("AUTOINCREMENTの高水位を空tableでも保持する", () => {
    const database = createPreMigrationDatabase()
    database.run(
      `INSERT INTO application_workflow_events
        (id, application_id, step_key, round, event_type, occurred_at, details_json)
       VALUES (80, 1, 'manager', 1, 'activated', '2026-01-01T00:00:00.000Z', '{}')`,
    )
    database.run("DELETE FROM application_workflow_events")

    applyMigration(database)
    database.run(
      `INSERT INTO application_workflow_events
        (application_id, step_key, round, event_type, occurred_at, details_json)
       VALUES (1, 'manager', 1, 'activated', '2026-01-01T00:00:00.000Z', '{}')`,
    )

    expect(
      database.query<{ id: number }, []>("SELECT id FROM application_workflow_events").get(),
    ).toEqual({ id: 81 })
  })
})
