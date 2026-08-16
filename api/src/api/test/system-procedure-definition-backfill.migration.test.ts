import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"

const coreSchema = readFileSync(
  new URL("../../contexts/system/infrastructure/schema/system-core.sql", import.meta.url),
  "utf8",
)
const workflowSchema = readFileSync(
  new URL("../../contexts/system/infrastructure/schema/system-workflow.sql", import.meta.url),
  "utf8",
)
const procedureSchema = readFileSync(
  new URL("../../contexts/system/infrastructure/schema/system-procedure.sql", import.meta.url),
  "utf8",
)
const migration = readFileSync(
  new URL("../../../migrations/0133_system_procedure_definition_backfill.sql", import.meta.url),
  "utf8",
)

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(coreSchema)
  database.exec(workflowSchema)
  database.exec(procedureSchema)
  database.exec(`
    CREATE TABLE application_templates (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      schema_json TEXT NOT NULL,
      approver_roles TEXT NOT NULL,
      system_binding TEXT,
      completion_handler_key TEXT
    );
    CREATE TABLE application_workflows (
      template_id INTEGER PRIMARY KEY,
      definition_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revision INTEGER NOT NULL,
      updated_by_account_id TEXT REFERENCES system_accounts(id) ON DELETE RESTRICT
    );
  `)

  return database
}

describe("System procedure definition backfill migration", () => {
  test("legacy role定義と版付きworkflowを欠落なくSystemへ移す", () => {
    const database = createDatabase()
    database.exec(`
      INSERT INTO system_accounts
        (id, status, token_version, created_at, updated_at)
      VALUES ('author', 'active', 0, 0, 0);
      INSERT INTO application_templates
        (id, code, name, category, description, schema_json, approver_roles,
         completion_handler_key)
      VALUES
        (1, 'legacy', 'Legacy', 'operation', NULL, '{}', '["manager"]', NULL),
        (2, 'versioned', 'Versioned', 'operation', 'safe', '{"type":"object"}',
         '[]', 'personnel_action');
      INSERT INTO application_workflows
        (template_id, definition_json, updated_at, revision, updated_by_account_id)
      VALUES
        (2, '{"version":1,"steps":[]}', '2026-01-01T00:00:00.000Z', 3, 'author');
    `)

    database.exec(migration)

    expect(
      database
        .query(
          `SELECT definition.key, definition.current_revision, number.number,
                  revision.decision_policy_json, revision.completion_operation_key,
                  revision.created_by_account_id
           FROM system_procedure_definitions AS definition
           JOIN system_procedure_numbers AS number ON number.procedure_key = definition.key
           JOIN system_procedure_definition_revisions AS revision
             ON revision.procedure_key = definition.key
            AND revision.revision = definition.current_revision
           ORDER BY number.number`,
        )
        .all(),
    ).toEqual([
      {
        key: "legacy",
        current_revision: 1,
        number: 1,
        decision_policy_json:
          '{"schemaVersion":1,"qualificationContext":"company","approverRoles":["manager"],"workflow":null,"workflowRevision":0}',
        completion_operation_key: null,
        created_by_account_id: "system:migration",
      },
      {
        key: "versioned",
        current_revision: 3,
        number: 2,
        decision_policy_json:
          '{"schemaVersion":1,"qualificationContext":"company","approverRoles":[],"workflow":{"version":1,"steps":[]},"workflowRevision":3}',
        completion_operation_key: "company.personnel-action.apply",
        created_by_account_id: "author",
      },
    ])
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    database.close()
  })

  test("不正JSONまたは不正keyがあればprocedureを部分移行しない", () => {
    const database = createDatabase()
    database.exec(`
      INSERT INTO application_templates
        (id, code, name, category, schema_json, approver_roles)
      VALUES
        (1, 'valid', 'Valid', 'operation', '{}', '[]'),
        (2, 'Invalid Key', 'Invalid', 'operation', '{', '[]');
    `)

    database.exec(migration)
    expect(
      database.query("SELECT count(*) AS count FROM system_procedure_definitions").get(),
    ).toEqual({ count: 0 })
    expect(
      database.query("SELECT count(*) AS count FROM system_procedure_definition_revisions").get(),
    ).toEqual({ count: 0 })
    expect(database.query("SELECT count(*) AS count FROM system_procedure_numbers").get()).toEqual({
      count: 0,
    })
    database.close()
  })
})
