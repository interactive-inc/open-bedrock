import { createD1TestDatabase } from "@/api/test/support/d1-test-database"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const migrationsDirectory = join(import.meta.dir, "../../../../../migrations")

function schemaThrough(fileName: string): string {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql") && file <= fileName)
    .sort()
    .map((file) => readFileSync(join(migrationsDirectory, file), "utf8"))
    .join("\n")
}

describe("Company organization migration", () => {
  test("backfills only explicit organization and lifecycle facts into one completed revision", async () => {
    const db = createD1TestDatabase(schemaThrough("0137_remove_grade_review_link.sql"))
    await db.exec(`
      INSERT INTO employees (id, code, name, status) VALUES
        (1, 'E001', 'Manager', 'active'),
        (2, 'E002', 'Member', 'active');
      INSERT INTO accounts (id, status, created_at, updated_at)
        VALUES (11, 'active', 0, 0);
      INSERT INTO account_employee_links (account_id, employee_id) VALUES (11, 1);
      INSERT INTO roles (id, key, name, is_system, created_at)
        VALUES (1, 'hr', 'Technical HR', 1, 0);
      INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
        VALUES (11, 1, NULL, 0);
      INSERT INTO departments (id, name) VALUES
        (10, 'Engineering'),
        (20, 'Platform');
      INSERT INTO org_departments
        (code, department_id, parent_code, manager_employee_code, sort_order)
      VALUES
        ('ENG', 10, NULL, 'E001', 1),
        ('PLATFORM', 20, 'ENG', NULL, 2);
      INSERT INTO org_memberships
        (department_code, employee_code, manager_employee_code)
      VALUES ('ENG', 'E002', 'E001');
      INSERT INTO employment_period_versions
        (period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at)
      VALUES
        ('employment-1', 1, 1, '2025-01-01', NULL, 0, 'fixture', 1),
        ('employment-2', 1, 2, '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_status_period_versions
        (period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES
        ('status-1', 1, 'employment-1', 1, 'active', '2025-01-01', NULL, 0, 'fixture', 1),
        ('status-2', 1, 'employment-2', 2, 'active', '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_org_assignment_period_versions
        (period_id, revision, employment_period_id, employee_id, department_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at)
      VALUES
        ('assignment-1', 1, 'employment-1', 1, 'ENG', 'primary', 'Manager', NULL,
         '2025-01-01', NULL, 0, 'fixture', 1),
        ('assignment-2', 1, 'employment-2', 2, 'ENG', 'primary', 'Member', 1,
         '2025-01-01', NULL, 0, 'fixture', 1);
      INSERT INTO employee_org_responsibility_period_versions
        (period_id, revision, department_code, responsibility_type, employee_id,
         starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES ('responsibility-1', 1, 'ENG', 'department_manager', 1,
              '2025-01-01', NULL, 0, 'fixture', 1);
      UPDATE lifecycle_migration_states
      SET status = 'verified', baseline_on = '2025-01-01'
      WHERE id = 1;
    `)

    await db.exec(readFileSync(join(migrationsDirectory, "0138_company_organization.sql"), "utf8"))

    expect(
      await db
        .prepare(
          `SELECT expected_revision, change_count, applied_count,
                  resulting_revision, status
             FROM organization_change_operations
            WHERE id = 'migration:0138:organization-baseline'`,
        )
        .first<{
          expected_revision: number
          change_count: number
          applied_count: number
          resulting_revision: number
          status: string
        }>(),
    ).toEqual({
      expected_revision: 0,
      change_count: 6,
      applied_count: 6,
      resulting_revision: 6,
      status: "COMPLETED",
    })
    expect(
      await db
        .prepare(
          `SELECT organization_unit_id, code, official_name, parent_organization_unit_id,
                  starts_on
             FROM organization_unit_period_versions
            WHERE organization_unit_id != 'company:root'
            ORDER BY code`,
        )
        .all(),
    ).toMatchObject({
      results: [
        {
          organization_unit_id: "department:ENG",
          code: "ENG",
          official_name: "Engineering",
          parent_organization_unit_id: "company:root",
          starts_on: "2025-01-01",
        },
        {
          organization_unit_id: "department:PLATFORM",
          code: "PLATFORM",
          official_name: "Platform",
          parent_organization_unit_id: "department:ENG",
          starts_on: "2025-01-01",
        },
      ],
    })
    expect(
      await db
        .prepare("SELECT count(*) AS count FROM organization_assignment_period_versions")
        .first<number>("count"),
    ).toBe(2)
    expect(
      await db
        .prepare(
          `SELECT employment_id, employee_id, organization_unit_id, responsibility_type
             FROM organization_responsibility_period_versions`,
        )
        .first<{
          employment_id: string
          employee_id: string
          organization_unit_id: string
          responsibility_type: string
        }>(),
    ).toEqual({
      employment_id: "employment:employment-1",
      employee_id: "employee:1",
      organization_unit_id: "department:ENG",
      responsibility_type: "MANAGER",
    })
    expect(
      await db
        .prepare("SELECT revision FROM organization_lifecycle_states WHERE id = 1")
        .first<number>("revision"),
    ).toBe(6)
    expect(
      await db
        .prepare(
          "SELECT count(*) AS count FROM organization_responsibility_period_versions WHERE responsibility_type = 'PEOPLE_OPERATIONS'",
        )
        .first<number>("count"),
    ).toBe(0)
  })

  test("rejects mutation and deletion of canonical facts", async () => {
    const db = createD1TestDatabase(schemaThrough("0138_company_organization.sql"))

    expect(
      db
        .prepare(
          "UPDATE organization_unit_period_versions SET official_name = 'Changed' WHERE organization_unit_id = 'company:root'",
        )
        .run(),
    ).rejects.toThrow("organization unit periods are append only")
    expect(
      db.prepare("DELETE FROM organization_units WHERE id = 'company:root'").run(),
    ).rejects.toThrow()
    expect(
      db
        .prepare(
          "UPDATE organization_change_operations SET expected_revision = 99 WHERE id = 'migration:0138:organization-baseline'",
        )
        .run(),
    ).rejects.toThrow("organization change operation is immutable")
  })
})
