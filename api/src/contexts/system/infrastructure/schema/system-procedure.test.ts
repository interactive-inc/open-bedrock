import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { systemProcedureSchema } from "@system/infrastructure/schema/system-procedure"

const coreSchemaSql = readFileSync(new URL("./system-core.sql", import.meta.url), "utf8")
const workflowSchemaSql = readFileSync(new URL("./system-workflow.sql", import.meta.url), "utf8")
const procedureSchemaSql = readFileSync(new URL("./system-procedure.sql", import.meta.url), "utf8")
const digest = "a".repeat(64)

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(coreSchemaSql)
  database.exec(workflowSchemaSql)
  database.exec(procedureSchemaSql)
  database.run(
    `INSERT INTO system_accounts
       (id, status, token_version, created_at, updated_at)
     VALUES ('creator', 'active', 0, 100, 100)`,
  )

  return database
}

function insertDefinition(database: Database): void {
  database.run(
    `INSERT INTO system_procedure_definitions
       (key, current_revision, status, created_at, updated_at)
     VALUES ('change', 1, 'active', 100, 100)`,
  )
  database.run(
    `INSERT INTO system_procedure_definition_revisions
       (procedure_key, revision, title, category, input_schema_json,
        decision_policy_json, created_by_account_id, created_at)
     VALUES ('change', 1, 'Change', 'operation', '{}', '{"steps":[]}', 'creator', 100)`,
  )
}

function insertProposal(database: Database): void {
  database.run(
    `INSERT INTO system_proposal_series
       (id, procedure_key, created_by_account_id, created_at)
     VALUES ('series-1', 'change', 'creator', 100)`,
  )
  database.run(
    `INSERT INTO system_proposals
       (id, series_id, version, procedure_key, procedure_revision, body_json,
        digest, created_by_account_id, created_at)
     VALUES ('proposal-1', 'series-1', 1, 'change', 1, '{"reason":"safe"}', ?, 'creator', 100)`,
    [digest],
  )
}

describe("System procedure schema", () => {
  test("released migrationをcanonical DDLと完全一致させる", () => {
    const releasedMigrationSql = readFileSync(
      new URL("../../../../../migrations/0132_system_procedure.sql", import.meta.url),
      "utf8",
    )

    expect(releasedMigrationSql).toBe(procedureSchemaSql)
  })

  test("Drizzle宣言とDDLのtable・column・indexを一致させ、System外FKを持たない", () => {
    const database = createDatabase()
    const declaredTables = Object.values(systemProcedureSchema)
      .map((table) => getTableConfig(table))
      .toSorted((left, right) => left.name.localeCompare(right.name))

    expect(declaredTables.map((table) => table.name)).toEqual([
      "system_procedure_definition_revisions",
      "system_procedure_definitions",
      "system_procedure_numbers",
      "system_proposal_cases",
      "system_proposal_numbers",
      "system_proposal_series",
      "system_proposals",
    ])

    const liveIndexes = new Set(
      database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
        )
        .all()
        .map((index) => index.name),
    )

    for (const table of declaredTables) {
      const columns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => column.name)
      const foreignTables = database
        .query<{ table: string }, []>(`PRAGMA foreign_key_list(${table.name})`)
        .all()
        .map((foreignKey) => foreignKey.table)

      expect(columns).toEqual(table.columns.map((column) => column.name))
      expect(foreignTables.every((foreignTable) => foreignTable.startsWith("system_"))).toBe(true)
      expect(
        table.indexes
          .map((index) => index.config.name)
          .filter((name): name is string => typeof name === "string" && !liveIndexes.has(name)),
      ).toEqual([])
    }

    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    database.close()
  })

  test("手続版を追記専用にし、現在版を一段ずつ進める", () => {
    const database = createDatabase()
    insertDefinition(database)

    expect(() =>
      database.run(
        "UPDATE system_procedure_definition_revisions SET title = 'Changed' WHERE procedure_key = 'change'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "UPDATE system_procedure_definitions SET current_revision = 2, updated_at = 110 WHERE key = 'change'",
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_procedure_definition_revisions
         (procedure_key, revision, title, category, input_schema_json,
          decision_policy_json, created_by_account_id, created_at)
       VALUES ('change', 2, 'Change v2', 'operation', '{}', '{}', 'creator', 110)`,
    )
    database.run(
      "UPDATE system_procedure_definitions SET current_revision = 2, updated_at = 110 WHERE key = 'change'",
    )
    expect(() =>
      database.run(
        "UPDATE system_procedure_definitions SET current_revision = 4, updated_at = 120 WHERE key = 'change'",
      ),
    ).toThrow()

    expect(
      database.query("SELECT current_revision FROM system_procedure_definitions").get(),
    ).toEqual({ current_revision: 2 })
    database.close()
  })

  test("提案のlineageとCaseのversion・digest・作成者を変更不能に固定する", () => {
    const database = createDatabase()
    insertDefinition(database)
    insertProposal(database)
    database.run(
      `INSERT INTO system_cases
         (id, subject_context, subject_kind, subject_id, subject_version,
          proposal_digest, created_by_account_id, status, created_at, updated_at)
       VALUES ('case-1', 'system', 'proposal', 'series-1', '1', ?, 'creator', 'pending', 100, 100)`,
      [digest],
    )
    database.run(
      "INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at) VALUES ('proposal-1', 'case-1', 100)",
    )

    expect(() =>
      database.run("UPDATE system_proposals SET body_json = '{}' WHERE id = 'proposal-1'"),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_proposals
           (id, series_id, version, procedure_key, procedure_revision, body_json,
            digest, created_by_account_id, supersedes_proposal_id, created_at)
         VALUES ('proposal-3', 'series-1', 3, 'change', 1, '{}', ?, 'creator', 'proposal-1', 120)`,
        [digest],
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "UPDATE system_proposal_cases SET linked_at = 101 WHERE proposal_id = 'proposal-1'",
      ),
    ).toThrow()

    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    database.close()
  })

  test("Caseとの不一致を部分的に受理しない", () => {
    const database = createDatabase()
    insertDefinition(database)
    insertProposal(database)
    database.run(
      `INSERT INTO system_cases
         (id, subject_context, subject_kind, subject_id, subject_version,
          proposal_digest, created_by_account_id, status, created_at, updated_at)
       VALUES ('case-1', 'system', 'proposal', 'wrong-series', '1', ?, 'creator', 'pending', 100, 100)`,
      [digest],
    )

    expect(() =>
      database.run(
        "INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at) VALUES ('proposal-1', 'case-1', 100)",
      ),
    ).toThrow()
    database.close()
  })
})
