-- Company workforce の初期状態を append-only lifecycle 台帳へ記録する。

INSERT INTO company_personnel_actions
  (id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
   requested_by_employee_id, source_type, source_application_id, corrects_action_id,
   operation_id, payload_fingerprint, summary_json)
SELECT
  'seed-lifecycle-action-' || employee.id,
  employee.id,
  'initial_state',
  '2026-01-01',
  1767225600,
  NULL,
  NULL,
  'system',
  NULL,
  NULL,
  'seed-lifecycle-operation-' || employee.id,
  '0000000000000000000000000000000000000000000000000000000000000000',
  json_object(
    'kind', 'initial_state',
    'eventOn', '2026-01-01',
    'department', CASE
      WHEN unit.code IS NULL THEN NULL
      ELSE json_object('code', unit.code, 'name', unit.official_name)
    END,
    'positionTitle', assignment.position_title,
    'managerEmployeeCode', manager.employee_code,
    'status', CASE employment.status
      WHEN 'ON_LEAVE' THEN 'leave'
      WHEN 'TERMINATED' THEN 'retired'
      ELSE 'active'
    END
  )
FROM company_employees employee
INNER JOIN company_employments employment ON employment.employee_id = employee.id
LEFT JOIN company_organization_assignment_period_versions assignment
  ON assignment.employee_id = employee.id
 AND assignment.assignment_type = 'PRIMARY'
 AND assignment.revision = 1
LEFT JOIN company_organization_unit_period_versions unit
  ON unit.organization_unit_id = assignment.organization_unit_id
 AND unit.revision = 1
LEFT JOIN company_employees manager ON manager.id = assignment.manager_employee_id;

INSERT INTO company_employment_period_versions
  (period_id, revision, employee_id, starts_on, ends_on, is_void,
   recorded_by_action_id, recorded_at)
SELECT
  employment.id,
  1,
  employment.employee_id,
  employment.hire_date,
  employment.termination_date,
  0,
  'seed-lifecycle-action-' || employment.employee_id,
  1767225600
FROM company_employments employment;

INSERT INTO company_employee_status_period_versions
  (period_id, revision, employment_period_id, employee_id, status, starts_on,
   ends_on, is_void, recorded_by_action_id, recorded_at)
SELECT
  'seed-status-' || employment.employee_id,
  1,
  employment.id,
  employment.employee_id,
  CASE employment.status WHEN 'ON_LEAVE' THEN 'leave' ELSE 'active' END,
  employment.hire_date,
  employment.termination_date,
  0,
  'seed-lifecycle-action-' || employment.employee_id,
  1767225600
FROM company_employments employment;

INSERT INTO company_employee_lifecycle_revisions (employee_id, revision, updated_at)
SELECT id, 0, 1767225600 FROM company_employees;
