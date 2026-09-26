import type { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  COMPANY_DEFAULT_ORGANIZATION_ID,
  COMPANY_ROOT_ORGANIZATION_UNIT_ID,
} from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import {
  applyMigration,
  databaseBefore,
  insertBypassingGuards,
  isUuid,
} from "../api/support/uuid-cutover-migration"

const TARGET = "0341_convert_company_organization_ids_to_uuid.sql"
const LEGACY_VALUES = new Set(["organization:default", "company:root", "department:D001"])

function dependents(database: Database) {
  return database
    .query<{ entry: string }, []>(
      `SELECT type || ':' || tbl_name || ':' || name || ':' || sql AS entry FROM sqlite_master
       WHERE type IN ('index', 'trigger', 'view') AND sql IS NOT NULL`,
    )
    .all()
    .map((row) => row.entry)
}

/** legacy_id 以外の列に旧来の組織・組織単位の ID が値として残っていないかを数える。 */
function legacyValueColumns(database: Database) {
  const found: string[] = []
  for (const { name } of database
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'",
    )
    .all()) {
    for (const { name: column } of database
      .query<{ name: string }, []>(`SELECT name FROM pragma_table_info('${name}')`)
      .all()) {
      // role の key の company:root は IAM の業務コードで、組織単位の ID ではない。
      if (column === "legacy_id" || (name === "system_iam_roles" && column === "key")) continue
      for (const { value } of database
        .query<{ value: unknown }, []>(`SELECT "${column}" AS value FROM "${name}"`)
        .all()) {
        if (typeof value !== "string") continue
        if (LEGACY_VALUES.has(value)) found.push(`${name}.${column}`)
        else if (value.startsWith("{")) {
          const json = JSON.parse(value) as Record<string, unknown>
          for (const key of ["organizationId", "organizationUnitId", "parentOrganizationUnitId"])
            if (LEGACY_VALUES.has(String(json[key]))) found.push(`${name}.${column}.${key}`)
        }
      }
    }
  }
  return found
}

function seed(database: Database) {
  insertBypassingGuards(
    database,
    "company_organization_units",
    "INSERT INTO company_organization_units (id, created_at) VALUES ('department:D001', 1)",
  )
  insertBypassingGuards(
    database,
    "company_organization_unit_period_versions",
    `INSERT INTO company_organization_unit_period_versions
       (period_id, revision, organization_unit_id, code, official_name, kind, parent_organization_unit_id,
        starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
     VALUES ('department:D001:initial', 1, 'department:D001', 'D001', 'Planning', 'DEPARTMENT', 'company:root',
             '2026-01-01', NULL, 0, 'initialization:organization:default', 1)`,
  )
  insertBypassingGuards(
    database,
    "company_resource_heads",
    `INSERT INTO company_resource_heads
       (organization_id, resource_type, resource_id, revision, organization_revision, state, effective_from, attributes_json, updated_at)
     VALUES ('organization:default', 'organization-unit', 'department:D001:initial', 1, 1, 'active', '2026-01-01',
             '{"organizationUnitId":"department:D001","code":"D001","officialName":"Planning","kind":"DEPARTMENT","parentOrganizationUnitId":"company:root"}', 1)`,
  )
}

test("既定の組織と最上位の組織単位を既知の UUID へ移し、参照と CHECK・trigger・view を追従させる", () => {
  const database = databaseBefore(TARGET)
  try {
    seed(database)
    const dependentsBefore = dependents(database).map((entry) =>
      entry.replaceAll("'organization:default'", `'${COMPANY_DEFAULT_ORGANIZATION_ID}'`),
    )
    const violationsBefore = database.query("PRAGMA foreign_key_check").all().length

    applyMigration(database, TARGET)

    expect(database.query("SELECT id, legacy_id FROM company_organizations").all()).toEqual([
      { id: COMPANY_DEFAULT_ORGANIZATION_ID, legacy_id: "organization:default" },
    ])
    const units = database
      .query<{ id: string; legacy_id: string }, []>(
        "SELECT id, legacy_id FROM company_organization_units ORDER BY legacy_id",
      )
      .all()
    expect(units.map((unit) => unit.legacy_id)).toEqual(["company:root", "department:D001"])
    expect(units[0]?.id).toBe(COMPANY_ROOT_ORGANIZATION_UNIT_ID)
    const department = units[1]?.id
    expect(isUuid(department)).toBe(true)
    expect(
      database
        .query(
          "SELECT organization_unit_id, parent_organization_unit_id FROM company_organization_unit_period_versions WHERE period_id = 'department:D001:initial'",
        )
        .get(),
    ).toEqual({
      organization_unit_id: department,
      parent_organization_unit_id: COMPANY_ROOT_ORGANIZATION_UNIT_ID,
    })
    expect(
      JSON.parse(
        database
          .query<{ attributes_json: string }, []>(
            "SELECT attributes_json FROM company_resource_heads WHERE resource_id = 'department:D001:initial'",
          )
          .get()?.attributes_json ?? "{}",
      ),
    ).toMatchObject({
      organizationUnitId: department,
      parentOrganizationUnitId: COMPANY_ROOT_ORGANIZATION_UNIT_ID,
    })
    expect(legacyValueColumns(database)).toEqual([])
    expect(
      database
        .query("SELECT name FROM sqlite_master WHERE sql LIKE '%organization:default%'")
        .all(),
    ).toEqual([])

    // 既存の index・trigger・view は新しい組織 ID で残り、足されるのは識別子を守る trigger だけ。
    const after = dependents(database)
    expect(dependentsBefore.filter((entry) => !after.includes(entry))).toEqual([])
    expect(
      after
        .filter((entry) => !dependentsBefore.includes(entry))
        .map((entry) => entry.split(":").slice(0, 3).join(":"))
        .toSorted(),
    ).toEqual(
      ["company_organizations", "company_organization_units"]
        .flatMap((table) => [
          `trigger:${table}:${table}_identity_update`,
          `trigger:${table}:${table}_legacy_id_insert`,
        ])
        .toSorted(),
    )
    expect(database.query("PRAGMA foreign_key_check").all()).toHaveLength(violationsBefore)
    expect(() =>
      database.run(
        "INSERT INTO company_organization_units (id, created_at) VALUES ('department:D002', 1)",
      ),
    ).toThrow("CHECK constraint failed")
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

test("組織が二つあれば止める", () => {
  const database = databaseBefore(TARGET)
  try {
    insertBypassingGuards(
      database,
      "company_organizations",
      "INSERT INTO company_organizations (id, revision, created_at, updated_at) VALUES ('organization:other', 0, 0, 0)",
    )

    expect(() => applyMigration(database, TARGET)).toThrow("CHECK constraint failed")
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
