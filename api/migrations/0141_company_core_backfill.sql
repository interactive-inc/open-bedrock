-- 旧Company projectionをportable Company coreのrevision 1へ一度だけ取り込む。
-- canonical coreに既存変更がある場合は触らず、legacy側を再び正本に戻さない。

CREATE TABLE _company_core_backfill_resources (
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active', 'void')),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (resource_type, resource_id)
);

INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'person',
  'person:' || employee.id,
  CASE WHEN employee.archived_at IS NULL THEN 'active' ELSE 'void' END,
  COALESCE(
    (SELECT min(starts_on) FROM employment_period_versions WHERE employee_id = employee.id),
    (SELECT baseline_on FROM lifecycle_migration_states WHERE id = 1),
    '1970-01-01'
  ),
  NULL,
  json_object('officialName', employee.name, 'phone', employee.phone),
  COALESCE(employee.archived_at, 0)
FROM employees AS employee;

INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'employee',
  'employee:' || employee.id,
  CASE WHEN employee.archived_at IS NULL THEN 'active' ELSE 'void' END,
  COALESCE(
    (SELECT min(starts_on) FROM employment_period_versions WHERE employee_id = employee.id),
    (SELECT baseline_on FROM lifecycle_migration_states WHERE id = 1),
    '1970-01-01'
  ),
  NULL,
  json_object(
    'personId', 'person:' || employee.id,
    'employeeCode', employee.code,
    'status', employee.status
  ),
  COALESCE(employee.archived_at, 0)
FROM employees AS employee;

WITH latest AS (
  SELECT version.*
  FROM employment_period_versions AS version
  WHERE version.revision = (
    SELECT max(candidate.revision)
    FROM employment_period_versions AS candidate
    WHERE candidate.period_id = version.period_id
  )
)
INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'employment',
  'employment:' || period_id,
  CASE WHEN is_void = 1 THEN 'void' ELSE 'active' END,
  starts_on,
  ends_on,
  json_object(
    'employeeId', 'employee:' || employee_id,
    'status', COALESCE((SELECT status FROM employees WHERE id = employee_id), 'unknown')
  ),
  recorded_at
FROM latest;

INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'account-employee-link',
  'link:' || link.account_id,
  'active',
  COALESCE(
    (SELECT min(starts_on) FROM employment_period_versions WHERE employee_id = link.employee_id),
    (SELECT baseline_on FROM lifecycle_migration_states WHERE id = 1),
    '1970-01-01'
  ),
  NULL,
  json_object(
    'accountId', CAST(link.account_id AS TEXT),
    'employeeId', 'employee:' || link.employee_id
  ),
  0
FROM account_employee_links AS link;

WITH latest AS (
  SELECT version.*
  FROM organization_unit_period_versions AS version
  WHERE version.revision = (
    SELECT max(candidate.revision)
    FROM organization_unit_period_versions AS candidate
    WHERE candidate.period_id = version.period_id
  )
)
INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'organization-unit',
  period_id,
  CASE WHEN is_void = 1 THEN 'void' ELSE 'active' END,
  starts_on,
  ends_on,
  json_object(
    'organizationUnitId', organization_unit_id,
    'code', code,
    'officialName', official_name,
    'kind', kind,
    'parentOrganizationUnitId', parent_organization_unit_id
  ),
  recorded_at
FROM latest;

WITH latest AS (
  SELECT version.*
  FROM organization_assignment_period_versions AS version
  WHERE version.revision = (
    SELECT max(candidate.revision)
    FROM organization_assignment_period_versions AS candidate
    WHERE candidate.period_id = version.period_id
  )
)
INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'assignment',
  period_id,
  CASE WHEN is_void = 1 THEN 'void' ELSE 'active' END,
  starts_on,
  ends_on,
  json_object(
    'employeeId', employee_id,
    'employmentId', employment_id,
    'organizationUnitId', organization_unit_id,
    'assignmentType', assignment_type,
    'positionTitle', position_title
  ),
  recorded_at
FROM latest;

WITH latest AS (
  SELECT version.*
  FROM organization_assignment_period_versions AS version
  WHERE version.manager_employee_id IS NOT NULL
    AND version.revision = (
      SELECT max(candidate.revision)
      FROM organization_assignment_period_versions AS candidate
      WHERE candidate.period_id = version.period_id
    )
)
INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'reporting-relation',
  'reporting:' || period_id,
  CASE WHEN is_void = 1 THEN 'void' ELSE 'active' END,
  starts_on,
  ends_on,
  json_object(
    'employeeId', employee_id,
    'managerEmployeeId', manager_employee_id,
    'organizationUnitId', organization_unit_id
  ),
  recorded_at
FROM latest;

WITH latest AS (
  SELECT version.*
  FROM organization_responsibility_period_versions AS version
  WHERE version.revision = (
    SELECT max(candidate.revision)
    FROM organization_responsibility_period_versions AS candidate
    WHERE candidate.period_id = version.period_id
  )
)
INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'organizational-authority',
  period_id,
  CASE WHEN is_void = 1 THEN 'void' ELSE 'active' END,
  starts_on,
  ends_on,
  json_object(
    'employeeId', employee_id,
    'employmentId', employment_id,
    'scopeType', 'organization-unit',
    'scopeId', organization_unit_id,
    'authority', responsibility_type
  ),
  recorded_at
FROM latest;

INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'responsibility',
  'responsibility:' || responsibility_type,
  'active',
  min(starts_on),
  NULL,
  json_object('code', responsibility_type, 'officialName', responsibility_type),
  max(recorded_at)
FROM organization_responsibility_period_versions
GROUP BY responsibility_type;

INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'position',
  'position:' || position.id,
  'active',
  substr(position.created_at, 1, 10),
  NULL,
  json_object(
    'code', position.code,
    'officialName', position.name,
    'rank', position.rank,
    'description', position.description
  ),
  0
FROM position_definitions AS position;

INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'grade',
  'grade:' || grade.id,
  'active',
  substr(grade.created_at, 1, 10),
  NULL,
  json_object(
    'code', grade.code,
    'officialName', grade.name,
    'rank', grade.rank,
    'description', grade.description
  ),
  0
FROM grade_definitions AS grade;

INSERT INTO _company_core_backfill_resources
  (resource_type, resource_id, state, effective_from, effective_to, attributes_json, recorded_at)
SELECT
  'personnel-action',
  action.id,
  'active',
  action.event_on,
  NULL,
  json_object(
    'actionType', action.kind,
    'employeeId', 'employee:' || action.employee_id,
    'sourceType', action.source_type,
    'correctsActionId', action.corrects_action_id,
    'summary', json(action.summary_json)
  ),
  CASE WHEN action.recorded_at < 100000000000 THEN action.recorded_at * 1000 ELSE action.recorded_at END
FROM personnel_actions AS action;

INSERT OR IGNORE INTO company_organizations (id, revision, created_at, updated_at)
VALUES ('organization:default', 0, 0, 0);

INSERT INTO company_command_receipts
  (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
SELECT
  'organization:default',
  'migration:open-bedrock-company-core-baseline-v1',
  '0000000000000000000000000000000000000000000000000000000000000000',
  0,
  1,
  COALESCE(max(recorded_at), 0)
FROM _company_core_backfill_resources
HAVING count(*) > 0
   AND (SELECT revision FROM company_organizations WHERE id = 'organization:default') = 0
   AND EXISTS (SELECT 1 FROM employees);

INSERT INTO company_resource_revisions
  (organization_id, resource_type, resource_id, revision, organization_revision,
   state, effective_from, effective_to, attributes_json, command_id,
   actor_account_id, reason, recorded_at)
SELECT
  'organization:default', resource_type, resource_id, 1, 1,
  state, effective_from, effective_to, attributes_json,
  'migration:open-bedrock-company-core-baseline-v1', 'system:migration',
  'Legacy Company baseline', recorded_at
FROM _company_core_backfill_resources
WHERE (SELECT revision FROM company_organizations WHERE id = 'organization:default') = 0
  AND EXISTS (SELECT 1 FROM employees)
ORDER BY resource_type, resource_id;

INSERT INTO company_resource_heads
  (organization_id, resource_type, resource_id, revision, organization_revision,
   state, effective_from, effective_to, attributes_json, updated_at)
SELECT
  'organization:default', resource_type, resource_id, 1, 1,
  state, effective_from, effective_to, attributes_json, recorded_at
FROM _company_core_backfill_resources
WHERE (SELECT revision FROM company_organizations WHERE id = 'organization:default') = 0
  AND EXISTS (SELECT 1 FROM employees)
ORDER BY resource_type, resource_id;

UPDATE company_organizations
SET revision = 1,
    created_at = COALESCE((SELECT min(recorded_at) FROM _company_core_backfill_resources), 0),
    updated_at = COALESCE((SELECT max(recorded_at) FROM _company_core_backfill_resources), 0)
WHERE id = 'organization:default'
  AND revision = 0
  AND EXISTS (SELECT 1 FROM _company_core_backfill_resources)
  AND EXISTS (SELECT 1 FROM employees);

DROP TABLE _company_core_backfill_resources;
