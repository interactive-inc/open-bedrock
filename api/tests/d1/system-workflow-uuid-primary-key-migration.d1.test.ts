import { afterAll, beforeAll, expect, test } from "bun:test"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0339_enforce_system_workflow_uuid_primary_keys.sql"

/** 主キーの値を変えずに UUID の CHECK を課す table と、その主キーの列。 */
const KEPT_TABLES = [
  ["system_proposal_series", "id"],
  ["system_proposals", "id"],
  ["system_cases", "id"],
  ["system_proposal_cases", "proposal_id"],
  ["system_delegations", "id"],
  ["system_delegation_procedure_scopes", "delegation_id"],
  ["system_execution_authorizations", "id"],
  ["system_human_attestations", "id"],
] as const

/** 新しい UUID の id を主キーにし、旧来の主キーを一意な属性として残す table と、その旧来の主キー。 */
const SURROGATE_TABLES = [
  ["system_procedure_definitions", "key"],
  ["system_procedure_definition_revisions", "procedure_key || ':' || revision"],
  ["system_decision_tasks", "case_id || ':' || task_key || ':' || round"],
  [
    "system_decision_task_candidates",
    "case_id || ':' || task_key || ':' || round || ':' || candidate_account_id || ':' || source",
  ],
  [
    "system_decision_task_exclusions",
    "case_id || ':' || task_key || ':' || round || ':' || excluded_account_id",
  ],
] as const

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({
    empty: ["system-workflow-uuid-migration", "system-workflow-uuid-migration-abort"],
  })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

async function values(database: D1Database, table: string, expression: string) {
  const rows = await database
    .prepare(`SELECT CAST(${expression} AS TEXT) AS value FROM ${table} ORDER BY value`)
    .all<{ value: string }>()
  return rows.results.map((row) => row.value)
}

async function nonUuid(database: D1Database, table: string, column = "id") {
  return (
    await database
      .prepare(`SELECT count(*) AS n FROM ${table} WHERE NOT (${uuidCheckPredicate(column)})`)
      .first<{ n: number }>()
  )?.n
}

test("seed 済みのローカルD1で主キーを UUID に揃え、role と割当の参照を新しい値へ移す", async () => {
  const database = await local.database("system-workflow-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  const keptBefore = Object.fromEntries(
    await Promise.all(
      KEPT_TABLES.map(async ([table, column]) => [table, await values(database, table, column)]),
    ),
  )
  const surrogateBefore = Object.fromEntries(
    await Promise.all(
      SURROGATE_TABLES.map(async ([table, key]) => [table, await values(database, table, key)]),
    ),
  )
  const rolesBefore = await values(database, "system_iam_roles", "id || '|' || key")
  const permissionsBefore = await values(
    database,
    "system_iam_role_permissions permission JOIN system_iam_roles role ON role.id = permission.role_id",
    "role.key || '|' || permission.permission_key",
  )
  const bindingsBefore = await values(
    database,
    "system_role_bindings binding JOIN system_iam_roles role ON role.id = binding.role_id",
    "binding.id || '|' || binding.account_id || '|' || role.key",
  )
  expect(rolesBefore.length).toBeGreaterThan(0)
  expect(bindingsBefore.length).toBeGreaterThan(0)

  await applyLocalD1Migration(database, TARGET)

  for (const [table, column] of KEPT_TABLES)
    expect({ table, ids: await values(database, table, column) }).toEqual({
      table,
      ids: keptBefore[table] ?? [],
    })
  for (const [table, key] of SURROGATE_TABLES) {
    expect({ table, keys: await values(database, table, key) }).toEqual({
      table,
      keys: surrogateBefore[table] ?? [],
    })
    expect({ table, invalid: await nonUuid(database, table) }).toEqual({ table, invalid: 0 })
  }
  // UUID でない主キーは置き換え、旧来の値を legacy_id に残す。UUID だった主キーは変えない。
  expect(
    await values(database, "system_iam_roles", "coalesce(legacy_id, id) || '|' || key"),
  ).toEqual(rolesBefore)
  expect(
    await values(
      database,
      "system_role_bindings binding JOIN system_iam_roles role ON role.id = binding.role_id",
      "coalesce(binding.legacy_id, binding.id) || '|' || binding.account_id || '|' || role.key",
    ),
  ).toEqual(bindingsBefore)
  expect(
    await values(
      database,
      "system_iam_role_permissions permission JOIN system_iam_roles role ON role.id = permission.role_id",
      "role.key || '|' || permission.permission_key",
    ),
  ).toEqual(permissionsBefore)
  for (const table of [
    "system_iam_roles",
    "system_iam_role_permissions",
    "system_role_bindings",
  ] as const)
    expect({ table, invalid: await nonUuid(database, table) }).toEqual({ table, invalid: 0 })
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  await expect(
    database
      .prepare(
        "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('role', 'test:role', 'custom', 'Role', 0, 0)",
      )
      .run(),
  ).rejects.toThrow("CHECK constraint failed")
}, 300_000)

test("UUID でない主キーが残っていれば migration 全体を戻し、行を失わない", async () => {
  const database = await local.database("system-workflow-uuid-migration-abort")
  await migrateLocalD1Before(database, TARGET)
  await database.batch([
    database.prepare(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('creator', 'active', 0, 0, 0)",
    ),
    database.prepare(
      "INSERT INTO system_procedure_definitions (key, current_revision, status, created_at, updated_at) VALUES ('uuid_migration_abort', 1, 'active', 0, 0)",
    ),
    database.prepare(
      "INSERT INTO system_proposal_series (id, procedure_key, created_by_account_id, created_at) VALUES ('series-1', 'uuid_migration_abort', 'creator', 0)",
    ),
  ])

  await expect(applyLocalD1Migration(database, TARGET)).rejects.toThrow("CHECK constraint failed")
  expect(await values(database, "system_proposal_series", "id")).toEqual(["series-1"])
  expect(
    await database
      .prepare(
        "SELECT count(*) AS n FROM pragma_table_info('system_iam_roles') WHERE name = 'legacy_id'",
      )
      .first<{ n: number }>(),
  ).toEqual({ n: 0 })
}, 300_000)
