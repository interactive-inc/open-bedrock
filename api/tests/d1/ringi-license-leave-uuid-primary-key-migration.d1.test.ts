import { afterAll, beforeAll, expect, test } from "bun:test"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0335_convert_ringi_license_leave_keys_to_uuid.sql"

const TABLES = ["leave_requests", "ringi_requests", "software_licenses"] as const

/** 業務コードや複合の主キーから、新しい UUID の id を主キーにした table。 */
const SURROGATE_TABLES = [
  "leave_balances",
  "leave_procedure_bindings",
  "ringi_procedure_bindings",
  "leave_decision_notifications",
] as const

/** 外部キーの無い同じ業務内の参照。移行後も親の行を指すことを確かめる。 */
const REFERENCES = [
  ["leave_requests", "previous_leave_request_id", "leave_requests"],
  ["leave_procedure_bindings", "leave_request_id", "leave_requests"],
  ["leave_decision_notifications", "leave_request_id", "leave_requests"],
  ["ringi_procedure_bindings", "ringi_id", "ringi_requests"],
  ["software_license_assignments", "license_id", "software_licenses"],
  ["software_license_changes", "license_id", "software_licenses"],
] as const

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({ empty: ["ringi-license-leave-uuid-migration"] })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

async function ids(database: D1Database, table: string, column: string) {
  const rows = await database
    .prepare(`SELECT ${column} AS value FROM ${table} ORDER BY CAST(${column} AS TEXT)`)
    .all<{ value: string | number }>()
  return rows.results.map((row) => String(row.value))
}

async function triggerNames(database: D1Database) {
  const rows = await database
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'trigger'
       AND tbl_name IN (${TABLES.map((table) => `'${table}'`).join(",")}) ORDER BY name`,
    )
    .all<{ name: string }>()
  return rows.results.map((row) => row.name)
}

test("seed 済みのローカルD1で全行を UUID に移し、旧主キーを legacy_id に残す", async () => {
  const database = await local.database("ringi-license-leave-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  const before = Object.fromEntries(
    await Promise.all(
      TABLES.map(async (table) => [table, await ids(database, table, "id")] as const),
    ),
  )
  const triggersBefore = await triggerNames(database)

  await applyLocalD1Migration(database, TARGET)

  let migratedRows = 0
  for (const table of TABLES) {
    expect({ table, legacy: await ids(database, table, "legacy_id") }).toEqual({
      table,
      legacy: before[table] ?? [],
    })
    const invalid = await database
      .prepare(`SELECT count(*) AS count FROM ${table} WHERE NOT (${uuidCheckPredicate("id")})`)
      .first<{ count: number }>()
    expect({ table, invalid: invalid?.count }).toEqual({ table, invalid: 0 })
    migratedRows += before[table]?.length ?? 0
  }
  expect(migratedRows).toBeGreaterThan(3)
  for (const table of SURROGATE_TABLES) {
    const rows = await database
      .prepare(`SELECT count(*) AS total, sum(${uuidCheckPredicate("id")}) AS valid FROM ${table}`)
      .first<{ total: number; valid: number | null }>()
    expect({ table, valid: rows?.valid ?? 0 }).toEqual({ table, valid: rows?.total ?? -1 })
  }
  expect(await triggerNames(database)).toEqual(
    [
      ...triggersBefore,
      ...TABLES.flatMap((table) => [`${table}_identity_update`, `${table}_legacy_id_insert`]),
    ].toSorted(),
  )
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  await expect(
    database
      .prepare(
        "INSERT INTO software_licenses (id, name, status, created_at) VALUES (100, 'x', 'active', '2026-01-01')",
      )
      .run(),
  ).rejects.toThrow("CHECK constraint failed")
}, 300_000)
