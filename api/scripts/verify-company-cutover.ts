import { Database } from "bun:sqlite"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { executeSql } from "./sql-statements"

const migrationsDir = join(import.meta.dir, "..", "migrations")
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
const database = new Database(":memory:")
database.run("PRAGMA foreign_keys = ON")

for (const file of migrationFiles.filter((file) => file < "0014")) {
  executeSql(database, readFileSync(join(migrationsDir, file), "utf8"), `migration ${file}`)
}

executeSql(
  database,
  `
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES ('1', 'active', 0, 0, 0), ('2', 'active', 0, 0, 0);

    INSERT INTO employees (id, code, name, dept_id, dept_name, position, status)
    VALUES
      (1, 'E001', 'Cutover One', 1, 'Root', 'Director', 'active'),
      (2, 'E002', 'Cutover Two', 2, 'People', 'Member', 'active');

    INSERT INTO account_employee_links (account_id, employee_id)
    VALUES ('1', 1), ('2', 2);

    INSERT INTO departments (id, name) VALUES (1, 'Root'), (2, 'People');
    INSERT INTO org_departments
      (code, department_id, parent_code, manager_employee_code, sort_order)
    VALUES ('D001', 1, NULL, 'E001', 1), ('D002', 2, 'D001', NULL, 1);
    INSERT INTO org_memberships
      (department_code, employee_code, manager_employee_code)
    VALUES ('D001', 'E001', NULL), ('D002', 'E002', 'E001');

    INSERT INTO personnel_actions
      (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
       requested_by_employee_id, source_type, source_application_id, corrects_action_id,
       operation_id, payload_fingerprint, summary_json)
    VALUES
      ('cutover-action-1', 1, 'initial_state', '2026-01-01', 1767225600, NULL,
       NULL, 'system', NULL, NULL, 'cutover-operation-1',
       '0000000000000000000000000000000000000000000000000000000000000000', '{}'),
      ('cutover-action-2', 2, 'initial_state', '2026-01-01', 1767225600, NULL,
       NULL, 'system', NULL, NULL, 'cutover-operation-2',
       '0000000000000000000000000000000000000000000000000000000000000000', '{}');

    INSERT INTO employment_period_versions
      (period_id, revision, employee_id, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at)
    VALUES
      ('cutover-employment-1', 1, 1, '2026-01-01', NULL, 0, 'cutover-action-1', 1767225600),
      ('cutover-employment-2', 1, 2, '2026-01-01', NULL, 0, 'cutover-action-2', 1767225600);

    INSERT INTO employee_status_period_versions
      (period_id, revision, employment_period_id, employee_id, status, starts_on,
       ends_on, is_void, recorded_by_action_id, recorded_at)
    VALUES
      ('cutover-status-1', 1, 'cutover-employment-1', 1, 'active', '2026-01-01',
       NULL, 0, 'cutover-action-1', 1767225600),
      ('cutover-status-2', 1, 'cutover-employment-2', 2, 'active', '2026-01-01',
       NULL, 0, 'cutover-action-2', 1767225600);

    INSERT INTO employee_lifecycle_revisions (employee_id, revision, updated_at)
    VALUES (1, 0, 1767225600), (2, 0, 1767225600);

    INSERT INTO organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status,
       recorded_at, request_fingerprint, actor_account_id, reason, evidence_references_json)
    SELECT 'cutover-organization', revision, 6, 0, revision + 6, 'PENDING', 1767225600,
      '0000000000000000000000000000000000000000000000000000000000000000',
      'system:cutover', 'Verify Company cutover', '[]'
    FROM organization_lifecycle_states WHERE id = 1;

    INSERT INTO organization_units (id, created_at)
    VALUES ('department:D001', 1767225600), ('department:D002', 1767225600);

    INSERT INTO organization_unit_period_versions
      (period_id, revision, organization_unit_id, code, official_name, kind,
       parent_organization_unit_id, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at)
    VALUES
      ('department:D001:cutover', 1, 'department:D001', 'D001', 'Root', 'DEPARTMENT',
       'company:root', '2026-01-01', NULL, 0, 'cutover-organization', 1767225600),
      ('department:D002:cutover', 1, 'department:D002', 'D002', 'People', 'DEPARTMENT',
       'department:D001', '2026-01-01', NULL, 0, 'cutover-organization', 1767225600);

    INSERT INTO employee_org_assignment_period_versions
      (period_id, revision, employment_period_id, employee_id, department_code,
       assignment_type, position_title, manager_employee_id, starts_on, ends_on,
       is_void, recorded_by_action_id, recorded_at)
    VALUES
      ('cutover-assignment-1', 1, 'cutover-employment-1', 1, 'D001', 'primary',
       'Director', NULL, '2026-01-01', NULL, 0, 'cutover-organization', 1767225600),
      ('cutover-assignment-2', 1, 'cutover-employment-2', 2, 'D002', 'primary',
       'Member', 1, '2026-01-01', NULL, 0, 'cutover-organization', 1767225600);

    INSERT INTO employee_org_responsibility_period_versions
      (period_id, revision, department_code, responsibility_type, employee_id,
       starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
    VALUES
      ('cutover-responsibility-1', 1, 'D001', 'department_manager', 1,
       '2026-01-01', NULL, 0, 'cutover-organization', 1767225600);

    INSERT INTO organization_responsibility_period_versions
      (period_id, revision, employment_id, employee_id, organization_unit_id,
       responsibility_type, starts_on, ends_on, is_void,
       recorded_by_action_id, recorded_at)
    VALUES
      ('responsibility-period:cutover-people-operations', 1,
       'employment:cutover-employment-2', 'employee:2', 'department:D002',
       'PEOPLE_OPERATIONS', '2026-01-01', NULL, 0, 'cutover-organization', 1767225600);

    UPDATE organization_change_operations
    SET status = 'COMPLETED'
    WHERE id = 'cutover-organization';
  `,
  "pre-cutover fixture",
)

for (const file of migrationFiles.filter((file) => file >= "0014")) {
  executeSql(database, readFileSync(join(migrationsDir, file), "utf8"), `migration ${file}`)
}

const row = database
  .query(
    `SELECT
       (SELECT count(*) FROM company_employees) AS employee_count,
       (SELECT count(*) FROM company_employments) AS employment_count,
       (SELECT count(*) FROM company_employment_period_versions
        WHERE period_id LIKE 'employment:%') AS normalized_employment_period_count,
       (SELECT count(*) FROM company_employee_status_period_versions
        WHERE employment_period_id LIKE 'employment:%') AS normalized_status_count,
       (SELECT count(*) FROM company_organization_assignment_period_versions
        WHERE employee_id IN ('1', '2') AND employment_id LIKE 'employment:%') AS assignment_count,
       (SELECT count(*) FROM company_organization_responsibility_period_versions
        WHERE employee_id IN ('1', '2') AND employment_id LIKE 'employment:%') AS responsibility_count,
       (SELECT count(*) FROM company_organization_change_operations
        WHERE recorded_at >= 100000000000) AS millisecond_operation_count,
       (SELECT count(*) FROM company_organization_unit_period_versions
        WHERE recorded_at > 0 AND recorded_at < 100000000000) AS second_unit_period_count`,
  )
  .get() as Record<string, number>

const retiredTableCount = (
  database
    .query(
      `SELECT count(*) AS count FROM sqlite_master
       WHERE type = 'table' AND name IN (
         'employees', 'account_employee_links', 'company_departments',
         'company_org_departments', 'company_org_memberships',
         'company_employee_org_assignment_period_versions',
         'company_employee_org_responsibility_period_versions'
       )`,
    )
    .get() as { count: number }
).count
const foreignKeyViolations = database.query("PRAGMA foreign_key_check").all()

if (
  row.employee_count !== 2 ||
  row.employment_count !== 2 ||
  row.normalized_employment_period_count !== 2 ||
  row.normalized_status_count !== 2 ||
  row.assignment_count !== 2 ||
  row.responsibility_count !== 2 ||
  row.millisecond_operation_count !== 1 ||
  row.second_unit_period_count !== 0 ||
  retiredTableCount !== 0 ||
  foreignKeyViolations.length !== 0
) {
  throw new Error(
    `Company cutover did not preserve canonical data: ${JSON.stringify({
      ...row,
      retiredTableCount,
      foreignKeyViolations,
    })}`,
  )
}

console.log("COMPANY CUTOVER OK")
