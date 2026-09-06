import { createCompanyD1TestDatabase } from "@/contexts/company/test/d1-test-database.test-support"

const schema = `
  CREATE TABLE company_workforce_resource_bindings (
    resource_type TEXT, resource_id TEXT, organization_id TEXT, employee_id TEXT
  );
  CREATE TABLE company_resource_revisions (
    organization_id TEXT, resource_type TEXT, resource_id TEXT, revision INTEGER,
    state TEXT, effective_from TEXT, effective_to TEXT, attributes_json TEXT
  );
  CREATE TABLE company_employments (
    id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, status TEXT NOT NULL,
    hire_date TEXT NOT NULL, termination_date TEXT
  );
  CREATE TABLE company_employment_period_versions (
    period_id TEXT NOT NULL, revision INTEGER NOT NULL, employee_id TEXT NOT NULL,
    starts_on TEXT NOT NULL, ends_on TEXT, is_void INTEGER NOT NULL,
    PRIMARY KEY (period_id, revision)
  );
  CREATE TABLE company_employee_status_period_versions (
    period_id TEXT NOT NULL, revision INTEGER NOT NULL, employment_period_id TEXT NOT NULL,
    employee_id TEXT NOT NULL, status TEXT NOT NULL, starts_on TEXT NOT NULL,
    ends_on TEXT, is_void INTEGER NOT NULL, PRIMARY KEY (period_id, revision)
  );
  INSERT INTO company_employments VALUES
    ('employment:1', 'employee:1', 'TERMINATED', '2026-01-01', '2026-09-30');
  INSERT INTO company_employment_period_versions VALUES
    ('employment:1', 1, 'employee:1', '2026-01-01', '2026-10-01', 0);
  INSERT INTO company_employee_status_period_versions VALUES
    ('status:1', 1, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-10-01', 0);

  CREATE TABLE company_employees (
    id TEXT PRIMARY KEY, official_name TEXT NOT NULL, employee_code TEXT,
    email TEXT, phone TEXT
  );
  CREATE TABLE company_organization_assignment_period_versions (
    period_id TEXT NOT NULL, revision INTEGER NOT NULL, employee_id TEXT NOT NULL,
    organization_unit_id TEXT NOT NULL, assignment_type TEXT NOT NULL, position_title TEXT,
    employment_id TEXT NOT NULL,
    starts_on TEXT NOT NULL, ends_on TEXT, is_void INTEGER NOT NULL,
    PRIMARY KEY (period_id, revision)
  );
  CREATE TABLE company_organization_unit_period_versions (
    period_id TEXT NOT NULL, revision INTEGER NOT NULL, organization_unit_id TEXT NOT NULL,
    code TEXT NOT NULL, official_name TEXT NOT NULL,
    starts_on TEXT NOT NULL, ends_on TEXT, is_void INTEGER NOT NULL,
    PRIMARY KEY (period_id, revision)
  );
  INSERT INTO company_employees VALUES ('employee:1', 'Example Person', 'E001', NULL, NULL);
`

export function createEmployeeEmploymentTestDatabase(additionalSql = ""): D1Database {
  return createCompanyD1TestDatabase(schema + additionalSql)
}
