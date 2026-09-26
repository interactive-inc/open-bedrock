import { afterAll, beforeAll, expect, test } from "bun:test"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0338_enforce_system_infrastructure_uuid_primary_keys.sql"

/** 主キーの値を変えずに UUID の CHECK を課す table と、その主キーの列。 */
const KEPT_TABLES = [
  ["system_attachments", "id"],
  ["system_attachment_preservations", "id"],
  ["system_preserved_records", "id"],
  ["system_record_source_freezes", "id"],
  ["system_record_coverage_pages", "id"],
  ["system_record_retirement_plans", "id"],
  ["system_record_retirement_receipts", "id"],
  ["system_record_source_retirements", "id"],
  ["system_connectors", "id"],
  ["system_integration_exchanges", "id"],
  ["system_external_assertions", "id"],
  ["system_reconciliation_runs", "id"],
  ["system_jobs", "id"],
  ["system_outbox_messages", "id"],
  ["system_inbox_messages", "id"],
  ["system_dead_letters", "id"],
  ["system_notification_messages", "id"],
  ["system_notification_deliveries", "id"],
  ["system_notification_resource_scopes", "message_id"],
  ["system_work_items", "id"],
  ["system_work_evidence", "attachment_id"],
] as const

/** 新しい UUID の列を主キーにした table と、その列。 */
const SURROGATE_TABLES = [
  ["system_record_disclosure_policies", "revision_id"],
  ["system_record_coverage_entries", "id"],
  ["system_record_retirement_attachment_pins", "id"],
  ["system_reconciliation_items", "id"],
  ["system_work_item_revisions", "id"],
  ["system_operation_receipts", "id"],
] as const

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({ empty: ["system-uuid-migration", "system-uuid-migration-abort"] })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

async function values(database: D1Database, table: string, column: string) {
  const rows = await database
    .prepare(`SELECT CAST(${column} AS TEXT) AS value FROM ${table} ORDER BY value`)
    .all<{ value: string }>()
  return rows.results.map((row) => row.value)
}

async function count(database: D1Database, table: string) {
  return (await database.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())?.n
}

test("seed 済みのローカルD1で主キーを UUID に揃え、行数と外部キーの整合を保つ", async () => {
  const database = await local.database("system-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  const keptBefore = Object.fromEntries(
    await Promise.all(
      KEPT_TABLES.map(async ([table, column]) => [table, await values(database, table, column)]),
    ),
  )
  const surrogateCounts = Object.fromEntries(
    await Promise.all(
      SURROGATE_TABLES.map(async ([table]) => [table, await count(database, table)]),
    ),
  )
  const batchJobsBefore = await values(database, "system_batch_jobs", "id")

  await applyLocalD1Migration(database, TARGET)

  for (const [table, column] of KEPT_TABLES)
    expect({ table, ids: await values(database, table, column) }).toEqual({
      table,
      ids: keptBefore[table] ?? [],
    })
  for (const [table, column] of SURROGATE_TABLES) {
    const rows = await database
      .prepare(
        `SELECT count(*) AS total, sum(${uuidCheckPredicate(column)}) AS valid FROM ${table}`,
      )
      .first<{ total: number; valid: number | null }>()
    expect({ table, total: rows?.total, valid: rows?.valid ?? 0 }).toEqual({
      table,
      total: surrogateCounts[table],
      valid: rows?.total ?? -1,
    })
  }
  expect(await values(database, "system_batch_jobs", "legacy_id")).toEqual(batchJobsBefore)
  expect(
    await database
      .prepare(
        `SELECT count(*) AS n FROM system_batch_jobs WHERE NOT (${uuidCheckPredicate("id")})`,
      )
      .first<{ n: number }>(),
  ).toEqual({ n: 0 })
  expect(
    batchJobsBefore.length + (keptBefore.system_notification_messages?.length ?? 0),
  ).toBeGreaterThan(4)
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  await expect(
    database
      .prepare("INSERT INTO system_batch_jobs (id, name, status) VALUES ('1', 'x', 'running')")
      .run(),
  ).rejects.toThrow("CHECK constraint failed")
}, 300_000)

test("UUID でない主キーが残っていれば migration 全体を戻し、行を失わない", async () => {
  const database = await local.database("system-uuid-migration-abort")
  await migrateLocalD1Before(database, TARGET)
  await database
    .prepare(
      `INSERT INTO system_notification_messages (id, kind, title, source_type, source_id, created_at)
       VALUES ('42', 'company:task', 'title', 'company:notification.source', '{}', 1)`,
    )
    .run()

  await expect(applyLocalD1Migration(database, TARGET)).rejects.toThrow("CHECK constraint failed")
  expect(await values(database, "system_notification_messages", "id")).toEqual(["42"])
  expect(
    await database
      .prepare(
        "SELECT count(*) AS n FROM pragma_table_info('system_batch_jobs') WHERE name = 'legacy_id'",
      )
      .first<{ n: number }>(),
  ).toEqual({ n: 0 })
}, 300_000)
