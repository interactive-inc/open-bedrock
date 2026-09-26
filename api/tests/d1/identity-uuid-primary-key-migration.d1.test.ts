import { afterAll, beforeAll, expect, test } from "bun:test"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0342_convert_identity_ids_to_uuid.sql"

/** 主キーを UUID にした識別の table と、その主キーの列。 */
const TABLES = [
  ["system_accounts", "id"],
  ["system_principals", "id"],
  ["system_identity_bindings", "id"],
  ["system_identity_profiles", "identity_id"],
  ["system_password_credentials", "identity_id"],
  ["company_employees", "id"],
  ["company_employments", "id"],
  ["company_account_employee_links", "account_id"],
  ["company_employee_lifecycle_revisions", "employee_id"],
  ["company_personnel_actions", "id"],
  ["company_organization_change_operations", "id"],
  ["company_workforce_resource_bindings", "id"],
  ["company_account_employee_resource_bindings", "resource_id"],
] as const

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({ empty: ["identity-uuid-migration"] })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

test("seed 済みのローカルD1で識別の主キーを UUID に揃え、行数と外部キーの整合を保つ", async () => {
  const database = await local.database("identity-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  const counts = new Map<string, number | undefined>()
  for (const [table] of TABLES)
    counts.set(
      table,
      (await database.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())?.n,
    )

  await applyLocalD1Migration(database, TARGET)

  for (const [table, column] of TABLES) {
    const row = await database
      .prepare(
        `SELECT count(*) AS total, sum(${uuidCheckPredicate(column)}) AS valid FROM ${table}`,
      )
      .first<{ total: number; valid: number | null }>()
    expect({ table, total: row?.total, valid: row?.valid ?? 0 }).toEqual({
      table,
      total: counts.get(table),
      valid: row?.total ?? -1,
    })
  }
  expect(counts.get("system_accounts")).toBeGreaterThan(0)
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
}, 300_000)
