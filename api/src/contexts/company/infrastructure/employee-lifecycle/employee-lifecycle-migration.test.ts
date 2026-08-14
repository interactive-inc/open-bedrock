import { createD1TestDatabase } from "@/contexts/company/interface/test-helpers/d1-test-database"
import { loadSchema } from "@/contexts/company/interface/test-helpers/load-schema"
import {
  applicationCompletionBindings,
  applicationSubjects,
  employeeLifecycleRevisions,
  employeeStatusPeriodVersions,
  employmentPeriodVersions,
  lifecycleEffectTemplateBindings,
  lifecycleMigrationState,
  lifecycleOutbox,
  organizationLifecycleState,
  orgAssignmentPeriodVersions,
  orgResponsibilityPeriodVersions,
  personnelActionRequests,
  personnelActions,
  schema,
} from "@/schema"
import { describe, expect, test } from "bun:test"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../../../migrations")
const migrationFile = "0019_employee_lifecycle.sql"
const migrationPath = join(migrationsDirectory, migrationFile)
const applicationBindingMigrationFile = "0036_application_lifecycle_binding.sql"
const applicationBindingMigrationPath = join(migrationsDirectory, applicationBindingMigrationFile)
const personnelActionTemplateMigrationFile = "0038_application_personnel_action_template.sql"
const personnelActionTemplateMigrationPath = join(
  migrationsDirectory,
  personnelActionTemplateMigrationFile,
)
const requestStateMigrationFile = "0037_application_personnel_action_request_state.sql"
const requestStateMigrationPath = join(migrationsDirectory, requestStateMigrationFile)
// 0019 以降に追加された、ライフサイクル列（archived_at 等）を前提とする後続 migration。
// 「lifecycle 適用前」のスナップショットには含めない（実順序では 0019 の後に走るため）。
// 0114 は 0019 より後に作られる表も一括で改名するため、この snapshot には含めない。
const postLifecycleMigrationFiles = new Set([
  "0030_identity_provisioning.sql",
  "0114_tables_rename.sql",
  "0125_audit_employee_contexts.sql",
  "0128_mbo_evaluation.sql",
  "0129_mbo_evaluation_fixes.sql",
])

function migrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
}

function schemaBeforeLifecycle(): string {
  return migrationFiles()
    .filter(
      (file) =>
        file !== migrationFile &&
        file !== applicationBindingMigrationFile &&
        file !== personnelActionTemplateMigrationFile &&
        file !== requestStateMigrationFile &&
        !postLifecycleMigrationFiles.has(file),
    )
    .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
    .join("\n")
}

function lifecycleMigrations(): string {
  expect(existsSync(migrationPath)).toBe(true)
  expect(existsSync(applicationBindingMigrationPath)).toBe(true)
  expect(existsSync(personnelActionTemplateMigrationPath)).toBe(true)
  expect(existsSync(requestStateMigrationPath)).toBe(true)
  return [
    migrationPath,
    applicationBindingMigrationPath,
    personnelActionTemplateMigrationPath,
    requestStateMigrationPath,
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")
}

async function tableNames(db: D1Database): Promise<string[]> {
  return (
    await db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all<{ name: string }>()
  ).results.map((row) => row.name)
}

async function insertAction(
  db: D1Database,
  overrides: { id?: string; operationId?: string; correctsActionId?: string | null } = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO personnel_actions
         (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
          requested_by_employee_id, source_type, source_application_id,
          corrects_action_id, operation_id, payload_fingerprint, summary_json)
       VALUES (?1, 1, 'hire', '2026-01-01', 1767225600, 1,
               NULL, 'direct', NULL, ?2, ?3,
               'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '{}')`,
    )
    .bind(
      overrides.id ?? "00000000-0000-4000-8000-000000000001",
      overrides.correctsActionId ?? null,
      overrides.operationId ?? "operation-1",
    )
    .run()
}

describe("employee lifecycle migration", () => {
  test("keeps numbered migrations continuous through 0020", () => {
    const numbered = migrationFiles().filter((file) => /^\d{4}_.+\.sql$/.test(file))

    expect(numbered.map((file) => file.slice(0, 4))).toEqual(
      Array.from({ length: numbered.length }, (_, index) => String(index + 1).padStart(4, "0")),
    )
    expect(numbered[19]).toBe("0020_governance.sql")
  })

  test("creates every lifecycle table in a fresh database", async () => {
    const db = createD1TestDatabase(loadSchema())
    const names = await tableNames(db)

    expect(names).toEqual(
      expect.arrayContaining([
        "personnel_actions",
        "employment_period_versions",
        "employee_status_period_versions",
        "employee_org_assignment_period_versions",
        "employee_org_responsibility_period_versions",
        "employee_lifecycle_revisions",
        "organization_lifecycle_states",
        "personnel_action_requests",
        "application_subjects",
        "application_completion_bindings",
        "lifecycle_migration_states",
        "lifecycle_outbox_entries",
        "lifecycle_effect_template_bindings",
      ]),
    )

    expect(
      await db
        .prepare("SELECT status FROM lifecycle_migration_states WHERE id = 1")
        .first<string>("status"),
    ).toBe("pending")
    expect(
      await db
        .prepare("SELECT revision FROM organization_lifecycle_states WHERE id = 1")
        .first<number>("revision"),
    ).toBe(0)
  })

  test("upgrades legacy rows without deleting or rewriting current-state columns", async () => {
    const db = createD1TestDatabase(schemaBeforeLifecycle())

    await db.exec(`
      INSERT INTO employees (id, code, name, dept_id, dept_name, position, status)
      VALUES (1, 'E001', 'Fixture User', 10, 'Legacy Department', 'Member', 'active');
      INSERT INTO departments (id, name) VALUES (10, 'Legacy Department');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES ('D001', 10, NULL, 'E001', 1);
      INSERT INTO application_templates
        (id, code, name, category, description, schema_json, approver_roles)
      VALUES (1, 'legacy', 'Legacy', 'general', NULL, '{}', '[]');
    `)

    await db.exec(lifecycleMigrations())

    expect(
      await db
        .prepare(
          `SELECT code, dept_name, position, status, archived_at, archived_by_account_id
           FROM employees WHERE id = 1`,
        )
        .first<{
          code: string
          dept_name: string
          position: string
          status: string
          archived_at: null
          archived_by_account_id: null
        }>(),
    ).toEqual({
      code: "E001",
      dept_name: "Legacy Department",
      position: "Member",
      status: "active",
      archived_at: null,
      archived_by_account_id: null,
    })
    expect(
      await db
        .prepare(
          `SELECT manager_employee_code, archived_at, archived_by_account_id
           FROM org_departments WHERE code = 'D001'`,
        )
        .first<{
          manager_employee_code: string
          archived_at: null
          archived_by_account_id: null
        }>(),
    ).toEqual({
      manager_employee_code: "E001",
      archived_at: null,
      archived_by_account_id: null,
    })
    expect(
      await db
        .prepare(
          `SELECT system_binding, completion_handler_key
           FROM application_templates WHERE code = 'legacy'`,
        )
        .first<{ system_binding: null; completion_handler_key: null }>(),
    ).toEqual({ system_binding: null, completion_handler_key: null })
  })

  test("guards action idempotency and correction branching", async () => {
    const db = createD1TestDatabase(loadSchema())
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture User', 'active');
    `)

    await insertAction(db)
    expect(insertAction(db, { id: "00000000-0000-4000-8000-000000000002" })).rejects.toThrow()

    await insertAction(db, {
      id: "00000000-0000-4000-8000-000000000003",
      operationId: "operation-3",
      correctsActionId: "00000000-0000-4000-8000-000000000001",
    })
    expect(
      insertAction(db, {
        id: "00000000-0000-4000-8000-000000000004",
        operationId: "operation-4",
        correctsActionId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow()
  })

  test("rejects updates and deletes from the append-only ledger and fact versions", async () => {
    const db = createD1TestDatabase(loadSchema())
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture User', 'active');
    `)
    await insertAction(db)
    await db.exec(`
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES ('employment-1', 1, 1, '2026-01-01', NULL, 0,
              '00000000-0000-4000-8000-000000000001', 1767225600);
    `)

    expect(
      db.prepare("UPDATE personnel_actions SET event_on = '2026-01-02'").run(),
    ).rejects.toThrow()
    expect(db.prepare("DELETE FROM personnel_actions").run()).rejects.toThrow()
    expect(
      db.prepare("UPDATE employment_period_versions SET ends_on = '2026-02-01'").run(),
    ).rejects.toThrow()
    expect(db.prepare("DELETE FROM employment_period_versions").run()).rejects.toThrow()
  })

  test("enforces version and managed-vocabulary checks", async () => {
    const db = createD1TestDatabase(loadSchema())
    await db.exec(`
      INSERT INTO employees (id, code, name, status)
      VALUES (1, 'E001', 'Fixture User', 'active');
    `)
    await insertAction(db)

    expect(
      db
        .prepare(
          `INSERT INTO employee_status_period_versions
             (period_id, revision, employment_period_id, employee_id, status,
              starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
           VALUES ('status-1', 0, 'employment-1', 1, 'active',
                   '2026-01-01', NULL, 0,
                   '00000000-0000-4000-8000-000000000001', 1767225600)`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          `INSERT INTO employee_org_assignment_period_versions
             (period_id, revision, employment_period_id, employee_id, department_code,
              assignment_type, position_title, manager_employee_id, starts_on, ends_on,
              is_void, recorded_by_action_id, recorded_at)
           VALUES ('assignment-1', 1, 'employment-1', 1, 'D001',
                   'unknown', NULL, NULL, '2026-01-01', NULL,
                   0, '00000000-0000-4000-8000-000000000001', 1767225600)`,
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          "INSERT INTO organization_lifecycle_states (id, revision, updated_at) VALUES (2, 0, 0)",
        )
        .run(),
    ).rejects.toThrow()
    expect(
      db.prepare("UPDATE organization_lifecycle_states SET revision = -1 WHERE id = 1").run(),
    ).rejects.toThrow()
  })

  test("seeds lifecycle permissions into the intended system roles", async () => {
    const db = createD1TestDatabase(loadSchema())
    const rows = (
      await db
        .prepare(
          `SELECT role.key AS role_key, permission.key AS permission_key
           FROM role_permissions role_permission
           INNER JOIN roles role ON role.id = role_permission.role_id
           INNER JOIN permissions permission ON permission.id = role_permission.permission_id
           WHERE permission.key LIKE 'employee:lifecycle:%'
              OR permission.key = 'employee:archive'
           ORDER BY role.key, permission.key`,
        )
        .all<{ role_key: string; permission_key: string }>()
    ).results

    expect(rows).toEqual([
      { role_key: "hr", permission_key: "employee:archive" },
      { role_key: "hr", permission_key: "employee:lifecycle:apply" },
      { role_key: "hr", permission_key: "employee:lifecycle:read:all" },
      { role_key: "hr", permission_key: "employee:lifecycle:request" },
      { role_key: "manager", permission_key: "employee:lifecycle:request" },
      { role_key: "root", permission_key: "employee:archive" },
      { role_key: "root", permission_key: "employee:lifecycle:apply" },
      { role_key: "root", permission_key: "employee:lifecycle:read:all" },
      { role_key: "root", permission_key: "employee:lifecycle:request" },
    ])
  })

  test("keeps every lifecycle table in the Drizzle schema export", () => {
    const lifecycleTables = [
      personnelActions,
      employmentPeriodVersions,
      employeeStatusPeriodVersions,
      orgAssignmentPeriodVersions,
      orgResponsibilityPeriodVersions,
      employeeLifecycleRevisions,
      organizationLifecycleState,
      personnelActionRequests,
      applicationSubjects,
      applicationCompletionBindings,
      lifecycleMigrationState,
      lifecycleOutbox,
      lifecycleEffectTemplateBindings,
    ]

    for (const table of lifecycleTables) {
      expect(getTableConfig(table).name.length).toBeGreaterThan(0)
      expect(Object.values(schema)).toContain(table)
    }
  })

  test("keeps the singleton organization state constraints in the Drizzle schema", () => {
    const checkNames = getTableConfig(organizationLifecycleState).checks.map(
      (constraint) => constraint.name,
    )

    expect(checkNames).toEqual(
      expect.arrayContaining([
        "organization_lifecycle_state_singleton",
        "organization_lifecycle_state_revision",
      ]),
    )
  })
})
