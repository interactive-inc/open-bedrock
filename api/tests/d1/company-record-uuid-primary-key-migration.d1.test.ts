import { afterAll, beforeAll, expect, test } from "bun:test"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0340_enforce_company_record_uuid_primary_keys.sql"

/** 新しい UUID の id を主キーにし、旧来の主キーを一意な属性として残す table。 */
const SURROGATE_TABLES = [
  "company_resource_heads",
  "company_resource_revisions",
  "company_organization_unit_period_versions",
  "company_organization_assignment_period_versions",
  "company_organization_responsibility_period_versions",
  "company_employment_period_versions",
  "company_employee_status_period_versions",
  "company_command_receipts",
  "company_definition_resource_adoptions",
  "company_profile_change_receipts",
  "company_organization_resource_adoptions",
  "company_assignment_resource_adoptions",
  "company_responsibility_resource_adoptions",
  "company_employee_resource_adoptions",
  "company_responsibility_source_adoptions",
  "company_responsibility_source_cutovers",
  "company_bootstrap_receipts",
  "company_grade_award_archives",
  "company_external_identity_imports",
  "company_account_profiles",
  "company_workforce_connection_completions",
] as const

/** 整数の主キーを UUID に置き換え、旧来の値を legacy_id に残す table。 */
const LEGACY_TABLES = ["company_personnel_annotations", "company_lifecycle_outbox_entries"] as const

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({
    empty: ["company-record-uuid-migration", "company-record-uuid-migration-abort"],
  })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

/** 移行前の主キーの列を連結した式。移行後は同じ列が一意な属性として残る。 */
async function keyExpression(database: D1Database, table: string) {
  const columns = await database
    .prepare(`SELECT name FROM pragma_table_info('${table}') WHERE pk > 0 ORDER BY pk`)
    .all<{ name: string }>()
  return columns.results
    .map((column) => `coalesce(CAST(${column.name} AS TEXT), '')`)
    .join(" || '|' || ")
}

async function values(database: D1Database, table: string, expression: string) {
  const rows = await database
    .prepare(`SELECT ${expression} AS value FROM ${table} ORDER BY value`)
    .all<{ value: string }>()
  return rows.results.map((row) => row.value)
}

async function nonUuid(database: D1Database, table: string) {
  return (
    await database
      .prepare(`SELECT count(*) AS n FROM ${table} WHERE NOT (${uuidCheckPredicate("id")})`)
      .first<{ n: number }>()
  )?.n
}

test("seed 済みのローカルD1で Company の記録を UUID の主キーへ移し、旧来の主キーと行数を保つ", async () => {
  const database = await local.database("company-record-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  const expressions = Object.fromEntries(
    await Promise.all(
      SURROGATE_TABLES.map(async (table) => [table, await keyExpression(database, table)] as const),
    ),
  )
  const keysBefore = Object.fromEntries(
    await Promise.all(
      SURROGATE_TABLES.map(
        async (table) => [table, await values(database, table, expressions[table] ?? "")] as const,
      ),
    ),
  )
  const legacyBefore = Object.fromEntries(
    await Promise.all(
      LEGACY_TABLES.map(
        async (table) => [table, await values(database, table, "CAST(id AS TEXT)")] as const,
      ),
    ),
  )
  expect(keysBefore.company_resource_heads?.length ?? 0).toBeGreaterThan(0)
  expect(legacyBefore.company_personnel_annotations?.length ?? 0).toBeGreaterThan(0)

  await applyLocalD1Migration(database, TARGET)

  for (const table of SURROGATE_TABLES) {
    expect({ table, keys: await values(database, table, expressions[table] ?? "") }).toEqual({
      table,
      keys: keysBefore[table] ?? [],
    })
    expect({ table, invalid: await nonUuid(database, table) }).toEqual({ table, invalid: 0 })
  }
  for (const table of LEGACY_TABLES) {
    expect({ table, legacy: await values(database, table, "legacy_id") }).toEqual({
      table,
      legacy: legacyBefore[table] ?? [],
    })
    expect({ table, invalid: await nonUuid(database, table) }).toEqual({ table, invalid: 0 })
  }
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
}, 300_000)

test("Company の撤去が停止中なら migration 全体を戻し、行を変えない", async () => {
  const database = await local.database("company-record-uuid-migration-abort")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  // 撤去の停止を作る正規の経路は監査と照合を伴うため、停止の行だけを検査用に入れて trigger を戻す。
  const trigger = await database
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'system_record_source_freezes_insert'")
    .first<{ sql: string }>()
  const eventId = crypto.randomUUID()
  const freezeId = crypto.randomUUID()
  await database.batch([
    database.prepare("DROP TRIGGER system_record_source_freezes_insert"),
    database
      .prepare(
        `INSERT INTO system_audit_events (event_id, action, target_type, outcome, occurred_at)
         VALUES (?1, 'system.record.source.freeze.created', 'system:record-source-freeze', 'succeeded', 0)`,
      )
      .bind(eventId),
    database
      .prepare(
        `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
         VALUES (?1, 'ns', 'company', 1, ?2, ?3)`,
      )
      .bind(
        freezeId,
        eventId,
        JSON.stringify({
          id: freezeId,
          sourceNamespace: "ns",
          ownerContext: "company",
          revision: 1,
          auditEventId: eventId,
          actorAccountId: "actor",
          reason: "migration test",
          createdAt: "2026-01-01T00:00:00.000Z",
          release: null,
        }),
      ),
    database.prepare(trigger?.sql ?? ""),
  ])
  const frozen = await database
    .prepare(
      "SELECT count(*) AS n FROM system_record_source_freezes WHERE owner_context = 'company' AND revision = 1",
    )
    .first<{ n: number }>()
  expect(frozen?.n).toBe(1)
  const annotationsBefore = await values(
    database,
    "company_personnel_annotations",
    "CAST(id AS TEXT)",
  )

  await expect(applyLocalD1Migration(database, TARGET)).rejects.toThrow("CHECK constraint failed")
  expect(await values(database, "company_personnel_annotations", "CAST(id AS TEXT)")).toEqual(
    annotationsBefore,
  )
  expect(
    await database
      .prepare(
        "SELECT count(*) AS n FROM pragma_table_info('company_resource_heads') WHERE name = 'id'",
      )
      .first<{ n: number }>(),
  ).toEqual({ n: 0 })
}, 300_000)
