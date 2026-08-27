import * as auditSchema from "@/contexts/company/infrastructure/schema/audit"
import * as companySchema from "@/contexts/company/infrastructure/schema/company"
import * as employeeEventSchema from "@/contexts/company/infrastructure/schema/employee-event"
import * as employeeLifecycleSchema from "@/contexts/company/infrastructure/schema/employee-lifecycle"
import * as employeeSchema from "@/contexts/company/infrastructure/schema/employee"
import * as employmentSchema from "@/contexts/company/infrastructure/schema/employment"
import * as gradeSchema from "@/contexts/company/infrastructure/schema/grade"
import * as organizationSchema from "@/contexts/company/infrastructure/schema/organization"
import * as positionSchema from "@/contexts/company/infrastructure/schema/position"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { executeSql } from "../../scripts/sql-statements"
import { schema } from "@/schema"

const migrationsDirectory = join(import.meta.dir, "../../migrations")
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
const companyCutoverIndex = migrationFiles.indexOf("0014_cut_over_company_context.sql")

function applyMigrations(database: Database, files: readonly string[]): void {
  for (const file of files) {
    executeSql(database, readFileSync(join(migrationsDirectory, file), "utf8"), file)
  }
}

test("Company cutover preserves records and matches every shared Company table", () => {
  expect(companyCutoverIndex).toBeGreaterThan(0)
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  applyMigrations(database, migrationFiles.slice(0, companyCutoverIndex))
  database.exec(`
    INSERT INTO system_accounts
      (id, status, token_version, closed_at, created_at, updated_at)
    VALUES ('account-existing', 'active', 0, NULL, 0, 0);
    INSERT INTO system_identity_bindings
      (id, account_id, provider, subject, created_at, activated_at)
    VALUES ('identity-existing', 'account-existing', 'password', 'existing@example.test', 0, 0);
    INSERT INTO system_identity_profiles
      (identity_id, email, email_verified, can_receive_email, updated_at)
    VALUES ('identity-existing', 'existing@example.test', 1, 1, 0);
    INSERT INTO employees
      (id, code, name, status, phone)
    VALUES (7, 'E007', 'Existing Employee', 'active', '000-0000');
    INSERT INTO account_employee_links (account_id, employee_id)
    VALUES ('account-existing', 7);
    INSERT INTO employee_events
      (id, employee_id, kind, effective_date, created_at)
    VALUES (11, 7, 'hired', '2026-01-01', '2026-01-01');
    INSERT INTO departments (id, name)
    VALUES (1, 'Existing Department');
    INSERT INTO org_departments
      (code, department_id, parent_code, manager_employee_code, sort_order)
    VALUES ('D001', 1, NULL, NULL, 1);
    INSERT INTO organization_change_operations (
      id, expected_revision, change_count, applied_count, resulting_revision, status,
      recorded_at, request_fingerprint, actor_account_id, reason, evidence_references_json
    ) VALUES (
      'test:add-existing-department', 1, 1, 0, 2, 'PENDING', 1,
      '0000000000000000000000000000000000000000000000000000000000000000',
      'system:test', 'Add existing department', '[]'
    );
    INSERT INTO organization_units (id, created_at)
    VALUES ('department:D001', 1);
    INSERT INTO organization_unit_period_versions (
      period_id, revision, organization_unit_id, code, official_name, kind,
      parent_organization_unit_id, starts_on, ends_on, is_void,
      recorded_by_action_id, recorded_at
    ) VALUES (
      'department:D001:initial', 1, 'department:D001', 'D001',
      'Existing Department', 'DEPARTMENT', 'company:root', '1970-01-01', NULL, 0,
      'test:add-existing-department', 1
    );
    UPDATE organization_change_operations
    SET status = 'COMPLETED'
    WHERE id = 'test:add-existing-department';
    INSERT INTO department_budgets
      (id, department_id, fiscal_period, period_start, period_end, amount, name, created_at)
    VALUES (13, 1, '2026', '2026-01-01', '2026-12-31', 1000, 'Existing', '2026-01-01');
  `)

  applyMigrations(database, migrationFiles.slice(companyCutoverIndex))

  expect(
    database
      .query(
        `SELECT id, official_name, employee_code, email, phone
         FROM company_employees WHERE id = '7'`,
      )
      .get(),
  ).toEqual({
    id: "7",
    official_name: "Existing Employee",
    employee_code: "E007",
    email: "existing@example.test",
    phone: "000-0000",
  })
  expect(
    database.query("SELECT account_id, employee_id FROM company_account_employee_links").get(),
  ).toEqual({ account_id: "account-existing", employee_id: "7" })
  expect(
    database
      .query("SELECT employee_id, status FROM company_employments WHERE employee_id = '7'")
      .get(),
  ).toEqual({ employee_id: "7", status: "ACTIVE" })
  expect(database.query("SELECT id FROM company_employee_events").get()).toEqual({ id: 11 })
  expect(database.query("SELECT id, organization_unit_id FROM expense_budgets").get()).toEqual({
    id: 13,
    organization_unit_id: "department:D001",
  })

  const declarations = [
    auditSchema,
    companySchema,
    employeeEventSchema,
    employeeLifecycleSchema,
    employeeSchema,
    employmentSchema,
    gradeSchema,
    organizationSchema,
    positionSchema,
  ].flatMap((schemaModule) =>
    Object.values(schemaModule).flatMap((declaration) => {
      try {
        return [getTableConfig(declaration)]
      } catch {
        return []
      }
    }),
  )
  const tables = new Map(declarations.map((table) => [table.name, table]))

  for (const table of tables.values()) {
    const actualColumns = database
      .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
      .all()
      .map((column) => column.name)
      .toSorted()
    expect(actualColumns).toEqual(table.columns.map((column) => column.name).toSorted())
  }

  expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
  database.close()
})

describe("Product schema migration contract", () => {
  const employeeReferenceColumns = new Set([
    "actor_id",
    "applicant_id",
    "approver_id",
    "author_employee_id",
    "author_id",
    "checker_employee_id",
    "decided_by_employee_id",
    "decider_id",
    "employee_id",
    "evaluator_id",
    "holder_employee_id",
    "manager_id",
    "member_id",
    "owner_employee_id",
    "primary_evaluator_id",
    "recipient_employee_id",
    "requester_employee_id",
    "requester_id",
    "respondent_id",
    "reviewer_employee_id",
    "secondary_evaluator_id",
    "sender_employee_id",
    "subject_employee_id",
    "target_employee_id",
    "traveler_id",
    "withdrawn_by_employee_id",
  ])

  test("all Drizzle tables match the migrated database and product workforce references are constrained", () => {
    const database = new Database(":memory:")
    database.exec("PRAGMA foreign_keys = ON")
    applyMigrations(database, migrationFiles)

    const declarations = Object.values(schema).flatMap((declaration) => {
      try {
        return [getTableConfig(declaration)]
      } catch {
        return []
      }
    })

    for (const table of declarations) {
      const actualColumns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${JSON.stringify(table.name)})`)
        .all()
        .map((column) => column.name)
        .toSorted()
      expect(actualColumns).toEqual(table.columns.map((column) => column.name).toSorted())
    }

    const violations: string[] = []
    const productTables = database
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
           AND name NOT LIKE 'company_%'
           AND name NOT LIKE 'system_%'
         ORDER BY name`,
      )
      .all()

    for (const { name: tableName } of productTables) {
      const columns = database
        .query<{ name: string; type: string }, []>(
          `PRAGMA table_info(${JSON.stringify(tableName)})`,
        )
        .all()
      const foreignKeys = database
        .query<{ from: string; table: string; to: string }, []>(
          `PRAGMA foreign_key_list(${JSON.stringify(tableName)})`,
        )
        .all()

      for (const column of columns) {
        const expectedParent = employeeReferenceColumns.has(column.name)
          ? "company_employees"
          : column.name === "organization_unit_id"
            ? "company_organization_units"
            : null
        if (expectedParent === null) continue

        const hasCanonicalForeignKey = foreignKeys.some(
          (foreignKey) =>
            foreignKey.from === column.name &&
            foreignKey.table === expectedParent &&
            foreignKey.to === "id",
        )
        if (column.type.toUpperCase() !== "TEXT" || hasCanonicalForeignKey === false) {
          violations.push(`${tableName}.${column.name} -> ${expectedParent}.id`)
        }
      }
    }

    expect(violations).toEqual([])
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    database.close()
  })
})
