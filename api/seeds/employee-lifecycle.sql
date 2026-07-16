-- fresh database 用の人事ライフサイクル正本。
-- upgrade database は batch/employee-lifecycle の preflight/backfill/verify を使う。

INSERT INTO personnel_actions
  (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
   requested_by_employee_id, source_type, source_application_id, corrects_action_id,
   operation_id, payload_fingerprint, summary_json)
SELECT
  'seed-lifecycle-action-' || employee.id,
  employee.id,
  'legacy_baseline',
  '2026-01-01',
  1767225600,
  NULL,
  NULL,
  'migration',
  NULL,
  NULL,
  'seed-lifecycle-operation-' || employee.id,
  '0000000000000000000000000000000000000000000000000000000000000000',
  json_object(
    'kind', 'legacy_baseline',
    'eventOn', '2026-01-01',
    'department', CASE
      WHEN organization.code IS NULL THEN NULL
      ELSE json_object('code', organization.code, 'name', department.name)
    END,
    'positionTitle', employee.position,
    'managerEmployeeCode', membership.manager_employee_code,
    'status', employee.status
  )
FROM employees AS employee
LEFT JOIN org_departments AS organization ON organization.department_id = employee.dept_id
LEFT JOIN departments AS department ON department.id = employee.dept_id
LEFT JOIN org_memberships AS membership
  ON membership.employee_code = employee.code
 AND membership.department_code = organization.code;

INSERT INTO employment_period_versions
  (period_id, revision, employee_id, starts_on, ends_on, is_void,
   recorded_by_action_id, recorded_at)
SELECT
  'seed-employment-' || id, 1, id, '2026-01-01', NULL, 0,
  'seed-lifecycle-action-' || id, 1767225600
FROM employees
WHERE status IN ('active', 'leave');

INSERT INTO employee_status_period_versions
  (period_id, revision, employment_period_id, employee_id, status, starts_on,
   ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT
  'seed-status-' || id, 1, 'seed-employment-' || id, id, status, '2026-01-01',
  NULL, 0, 'seed-lifecycle-action-' || id, 1767225600
FROM employees
WHERE status IN ('active', 'leave');

INSERT INTO org_assignment_period_versions
  (period_id, revision, employment_period_id, employee_id, department_code,
   assignment_type, position_title, manager_employee_id, starts_on, ends_on,
   is_void, recorded_by_action_id, recorded_at)
SELECT
  'seed-assignment-' || employee.id,
  1,
  'seed-employment-' || employee.id,
  employee.id,
  organization.code,
  'primary',
  employee.position,
  manager.id,
  '2026-01-01',
  NULL,
  0,
  'seed-lifecycle-action-' || employee.id,
  1767225600
FROM employees AS employee
INNER JOIN org_departments AS organization ON organization.department_id = employee.dept_id
LEFT JOIN org_memberships AS membership
  ON membership.employee_code = employee.code
 AND membership.department_code = organization.code
LEFT JOIN employees AS manager ON manager.code = membership.manager_employee_code
WHERE employee.status IN ('active', 'leave');

INSERT INTO org_responsibility_period_versions
  (period_id, revision, department_code, responsibility_type, employee_id,
   starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT
  'seed-responsibility-' || organization.code,
  1,
  organization.code,
  'department_manager',
  manager.id,
  '2026-01-01',
  NULL,
  0,
  'seed-lifecycle-action-' || manager.id,
  1767225600
FROM org_departments AS organization
INNER JOIN employees AS manager ON manager.code = organization.manager_employee_code;

INSERT INTO employee_lifecycle_revisions (employee_id, revision, updated_at)
SELECT id, 0, 1767225600 FROM employees;

UPDATE organization_lifecycle_state SET revision = 0, updated_at = 1767225600 WHERE id = 1;

UPDATE lifecycle_migration_state
SET status = 'verified',
    baseline_on = '2026-01-01',
    company_time_zone = 'Asia/Tokyo',
    legacy_source_fingerprint = 'fresh-seed-v1',
    employee_count = (SELECT COUNT(*) FROM employees),
    department_count = (SELECT COUNT(*) FROM org_departments),
    backfilled_at = 1767225600,
    verified_at = 1767225600
WHERE id = 1;
