-- fresh database 用の人事ライフサイクル正本。

INSERT INTO personnel_actions
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

-- Company 組織の初期状態は、部門・配属・責務を一つの原子的な変更として作る。
WITH change_count AS (
  SELECT
    (SELECT count(*) FROM org_departments)
    + (SELECT count(*)
       FROM employees AS employee
       JOIN org_departments AS organization ON organization.department_id = employee.dept_id
       WHERE employee.status IN ('active', 'leave'))
    + (SELECT count(*)
       FROM org_departments AS organization
       JOIN employees AS manager ON manager.code = organization.manager_employee_code
       WHERE manager.status IN ('active', 'leave'))
    + (SELECT count(*)
       FROM employees AS employee
       WHERE employee.code = 'E003' AND employee.status IN ('active', 'leave')) AS value
)
INSERT INTO organization_change_operations (
  id, expected_revision, change_count, applied_count, resulting_revision, status,
  recorded_at, request_fingerprint, actor_account_id, reason, evidence_references_json
)
SELECT
  'initialization:company-organization',
  state.revision,
  change_count.value,
  0,
  state.revision + change_count.value,
  'PENDING',
  1767225600,
  '0000000000000000000000000000000000000000000000000000000000000000',
  'system:initialization',
  'Initialize Company organization',
  '[]'
FROM organization_lifecycle_states AS state
CROSS JOIN change_count
WHERE state.id = 1;

INSERT INTO organization_units (id, created_at)
SELECT 'department:' || code, 1767225600
FROM org_departments
ORDER BY code;

INSERT INTO organization_unit_period_versions (
  period_id, revision, organization_unit_id, code, official_name, kind,
  parent_organization_unit_id, starts_on, ends_on, is_void,
  recorded_by_action_id, recorded_at
)
SELECT
  'department:' || organization.code || ':initial',
  1,
  'department:' || organization.code,
  organization.code,
  department.name,
  'DEPARTMENT',
  CASE
    WHEN organization.parent_code IS NULL THEN 'company:root'
    ELSE 'department:' || organization.parent_code
  END,
  '2026-01-01',
  NULL,
  0,
  'initialization:company-organization',
  1767225600
FROM org_departments AS organization
JOIN departments AS department ON department.id = organization.department_id
ORDER BY organization.code;

INSERT INTO employee_org_assignment_period_versions
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
  'initialization:company-organization',
  1767225600
FROM employees AS employee
JOIN org_departments AS organization ON organization.department_id = employee.dept_id
LEFT JOIN org_memberships AS membership
  ON membership.employee_code = employee.code
 AND membership.department_code = organization.code
LEFT JOIN employees AS manager ON manager.code = membership.manager_employee_code
WHERE employee.status IN ('active', 'leave')
ORDER BY employee.id;

INSERT INTO employee_org_responsibility_period_versions
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
  'initialization:company-organization',
  1767225600
FROM org_departments AS organization
JOIN employees AS manager ON manager.code = organization.manager_employee_code
WHERE manager.status IN ('active', 'leave')
ORDER BY organization.code;

-- 判断資格は technical role ではなく Company の期間付き責務を正本にする。
INSERT INTO organization_responsibility_period_versions (
  period_id, revision, employment_id, employee_id, organization_unit_id,
  responsibility_type, starts_on, ends_on, is_void,
  recorded_by_action_id, recorded_at
)
SELECT
  'responsibility-period:people-operations:' || employee.id,
  1,
  'employment:seed-employment-' || employee.id,
  'employee:' || employee.id,
  'department:' || organization.code,
  'PEOPLE_OPERATIONS',
  '2026-01-01',
  NULL,
  0,
  'initialization:company-organization',
  1767225600
FROM employees AS employee
JOIN org_departments AS organization ON organization.department_id = employee.dept_id
WHERE employee.code = 'E003' AND employee.status IN ('active', 'leave');

UPDATE organization_change_operations
SET status = 'COMPLETED'
WHERE id = 'initialization:company-organization';

INSERT INTO employee_lifecycle_revisions (employee_id, revision, updated_at)
SELECT id, 0, 1767225600 FROM employees;
