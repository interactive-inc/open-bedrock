import { afterAll, beforeAll, expect, test } from "bun:test"
import {
  COMPANY_DEFAULT_ORGANIZATION_ID,
  COMPANY_ROOT_ORGANIZATION_UNIT_ID,
} from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { uuidCheckPredicate } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@tests/d1/support/start-local-d1"
import {
  applyLocalD1Migration,
  migrateLocalD1Before,
  seedLocalD1,
} from "@tests/d1/support/migrate-local-d1-before"

const TARGET = "0341_convert_company_organization_ids_to_uuid.sql"

/** 組織単位を指す列。移行後はすべて組織単位の行を指す。 */
const UNIT_REFERENCES = [
  ["company_organization_unit_period_versions", "organization_unit_id"],
  ["company_organization_unit_period_versions", "parent_organization_unit_id"],
  ["company_organization_assignment_period_versions", "organization_unit_id"],
  ["company_organization_responsibility_period_versions", "organization_unit_id"],
  ["expenses", "organization_unit_id"],
  ["expense_budgets", "organization_unit_id"],
  ["career_postings", "organization_unit_id"],
] as const

/** 組織を指す列。移行後はすべて既知の組織 ID を持つ。 */
const ORGANIZATION_REFERENCES = [
  "company_resource_heads",
  "company_resource_revisions",
  "company_command_receipts",
  "company_account_profiles",
  "company_workforce_resource_bindings",
  "company_account_employee_resource_bindings",
  "company_grade_award_archives",
] as const

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({
    empty: ["company-organization-uuid-migration", "company-organization-uuid-migration-abort"],
  })
}, 120_000)

afterAll(async () => {
  await local.dispose()
})

async function count(database: D1Database, sql: string) {
  return (await database.prepare(sql).first<{ n: number }>())?.n
}

test("seed 済みのローカルD1で組織と組織単位の ID を UUID へ移し、参照と行数を保つ", async () => {
  const database = await local.database("company-organization-uuid-migration")
  await migrateLocalD1Before(database, TARGET)
  await seedLocalD1(database)
  const unitsBefore = await database
    .prepare("SELECT id FROM company_organization_units ORDER BY id")
    .all<{ id: string }>()
  const referencesBefore = Object.fromEntries(
    await Promise.all(
      UNIT_REFERENCES.map(
        async ([table, column]) =>
          [
            `${table}.${column}`,
            await count(database, `SELECT count(${column}) AS n FROM ${table}`),
          ] as const,
      ),
    ),
  )
  const organizationRowsBefore = Object.fromEntries(
    await Promise.all(
      ORGANIZATION_REFERENCES.map(
        async (table) =>
          [table, await count(database, `SELECT count(*) AS n FROM ${table}`)] as const,
      ),
    ),
  )
  expect(unitsBefore.results.length).toBeGreaterThan(1)

  await applyLocalD1Migration(database, TARGET)

  expect(
    (await database.prepare("SELECT id, legacy_id FROM company_organizations").all()).results,
  ).toEqual([{ id: COMPANY_DEFAULT_ORGANIZATION_ID, legacy_id: "organization:default" }])
  const unitsAfter = await database
    .prepare("SELECT id, legacy_id FROM company_organization_units ORDER BY legacy_id")
    .all<{ id: string; legacy_id: string }>()
  expect(unitsAfter.results.map((unit) => unit.legacy_id).toSorted()).toEqual(
    unitsBefore.results.map((unit) => unit.id).toSorted(),
  )
  expect(unitsAfter.results.find((unit) => unit.legacy_id === "company:root")?.id).toBe(
    COMPANY_ROOT_ORGANIZATION_UNIT_ID,
  )
  expect(
    await count(
      database,
      `SELECT count(*) AS n FROM company_organization_units WHERE NOT (${uuidCheckPredicate("id")})`,
    ),
  ).toBe(0)
  for (const [table, column] of UNIT_REFERENCES) {
    const key = `${table}.${column}`
    expect({
      key,
      references: await count(database, `SELECT count(${column}) AS n FROM ${table}`),
      resolved: await count(
        database,
        `SELECT count(*) AS n FROM ${table} child JOIN company_organization_units unit ON unit.id = child.${column}`,
      ),
    }).toEqual({ key, references: referencesBefore[key], resolved: referencesBefore[key] })
  }
  for (const table of ORGANIZATION_REFERENCES) {
    expect({
      table,
      rows: await count(database, `SELECT count(*) AS n FROM ${table}`),
      current: await count(
        database,
        `SELECT count(*) AS n FROM ${table} WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      ),
    }).toEqual({
      table,
      rows: organizationRowsBefore[table],
      current: organizationRowsBefore[table],
    })
  }
  expect(
    await count(
      database,
      "SELECT count(*) AS n FROM sqlite_master WHERE sql LIKE '%organization:default%'",
    ),
  ).toBe(0)
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
}, 300_000)

test("組織が二つあれば migration 全体を戻し、組織の ID を変えない", async () => {
  const database = await local.database("company-organization-uuid-migration-abort")
  await migrateLocalD1Before(database, TARGET)
  await database
    .prepare(
      "INSERT INTO company_organizations (id, revision, name, representative_name, created_at, updated_at) VALUES ('organization:other', 0, '', '', 0, 0)",
    )
    .run()

  await expect(applyLocalD1Migration(database, TARGET)).rejects.toThrow("CHECK constraint failed")
  expect(
    (await database.prepare("SELECT id FROM company_organizations ORDER BY id").all()).results,
  ).toEqual([{ id: "organization:default" }, { id: "organization:other" }])
  expect(
    await count(
      database,
      "SELECT count(*) AS n FROM pragma_table_info('company_organizations') WHERE name = 'legacy_id'",
    ),
  ).toBe(0)
}, 300_000)
