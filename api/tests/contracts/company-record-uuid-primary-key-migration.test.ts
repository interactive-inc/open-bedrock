import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0340_enforce_company_record_uuid_primary_keys.sql"

/** 新しい UUID の主キーを足した table。旧来の主キーは一意な属性として残る。 */
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

function dependents(database: Database) {
  return database
    .query<{ entry: string }, []>(
      `SELECT type || ':' || tbl_name || ':' || name || ':' || sql AS entry FROM sqlite_master
       WHERE type IN ('index', 'trigger', 'view') AND tbl_name LIKE 'company\\_%' ESCAPE '\\' AND sql IS NOT NULL`,
    )
    .all()
    .map((row) => row.entry)
}

test("Company の記録の主キーを UUID にし、旧来の主キーと命令 ID を一意な属性として残す", () => {
  const database = databaseBefore(TARGET)
  try {
    const counts = Object.fromEntries(
      [...SURROGATE_TABLES, ...LEGACY_TABLES].map((table) => [
        table,
        database.query<{ n: number }, []>(`SELECT count(*) AS n FROM ${table}`).get()?.n ?? -1,
      ]),
    )
    const heads = database
      .query<{ key: string }, []>(
        "SELECT organization_id || '|' || resource_type || '|' || resource_id AS key FROM company_resource_heads ORDER BY key",
      )
      .all()
    const dependentsBefore = dependents(database)
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length

    applyMigration(database, TARGET)

    for (const table of [...SURROGATE_TABLES, ...LEGACY_TABLES]) {
      const rows = database
        .query<{ id: string }, []>(`SELECT id FROM ${table}`)
        .all()
        .map((row) => row.id)
      expect({ table, count: rows.length, uuid: rows.every(isUuid) }).toEqual({
        table,
        count: counts[table],
        uuid: true,
      })
    }
    expect(
      database
        .query<{ key: string }, []>(
          "SELECT organization_id || '|' || resource_type || '|' || resource_id AS key FROM company_resource_heads ORDER BY key",
        )
        .all(),
    ).toEqual(heads)

    // 既存の index・trigger・view は定義ごと残り、足されるのは識別子を守る trigger だけ。
    const after = dependents(database)
    expect(dependentsBefore.filter((entry) => !after.includes(entry))).toEqual([])
    expect(
      after
        .filter((entry) => !dependentsBefore.includes(entry))
        .map((entry) => entry.split(":").slice(0, 3).join(":"))
        .toSorted(),
    ).toEqual(
      [
        ...SURROGATE_TABLES.map((table) => `trigger:${table}:${table}_identity_update`),
        ...LEGACY_TABLES.flatMap((table) => [
          `trigger:${table}:${table}_identity_update`,
          `trigger:${table}:${table}_legacy_id_insert`,
        ]),
      ].toSorted(),
    )
    expect(database.query("PRAGMA foreign_key_check").all()).toHaveLength(violationsBefore)
    expect(
      database
        .query(
          "SELECT name FROM sqlite_master WHERE name LIKE '\\_%' ESCAPE '\\' OR name LIKE '\\_\\_new\\_%' ESCAPE '\\'",
        )
        .all(),
    ).toEqual([])
  } finally {
    database.close()
  }
})

test("整数の主キーの行を UUID に移し、旧来の値を legacy_id に残す", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "company_personnel_annotations",
      `INSERT INTO company_personnel_annotations (id, employee_id, kind, effective_date, created_at)
       VALUES (7, 'employee', 'transfer', '2026-04-01', '2026-04-01T00:00:00.000Z')`,
    )

    applyMigration(database, TARGET)

    const row = database
      .query<{ id: string; legacy_id: string }, []>(
        "SELECT id, legacy_id FROM company_personnel_annotations",
      )
      .get()
    expect(isUuid(row?.id)).toBe(true)
    expect(row?.legacy_id).toBe("7")
  } finally {
    database.close()
  }
})

test("Company の撤去が停止中なら止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "system_record_source_freezes",
      `INSERT INTO system_record_source_freezes (id, source_namespace, owner_context, revision, created_audit_event_id, snapshot_json)
       VALUES ('${crypto.randomUUID()}', 'ns', 'company', 1, '${crypto.randomUUID()}', '{}')`,
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
  } finally {
    database.close()
  }
})
