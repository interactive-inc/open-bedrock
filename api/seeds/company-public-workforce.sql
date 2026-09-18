-- ローカル専用の架空従業員を公開Company履歴へ接続する。
-- 原資料が必要な既存環境への移行には使用しない。
INSERT INTO company_command_receipts
  (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
VALUES ('organization:default', 'seed:public-workforce',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 2, 3, 1767225600000);

INSERT INTO company_resource_revisions
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
SELECT 'organization:default', 'person', 'person:seed:' || employee.id, 1, 3, 'active',
  employment.hire_date, NULL,
  json_object('officialName', employee.official_name, 'email', employee.email, 'phone', employee.phone),
  'seed:public-workforce', '1', 'Confirmed development sample', 1767225600000
FROM company_employees employee
JOIN company_employments employment ON employment.employee_id = employee.id;

INSERT INTO company_resource_heads
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, updated_at)
SELECT organization_id, resource_type, resource_id, revision, organization_revision, state,
  effective_from, effective_to, attributes_json, recorded_at
FROM company_resource_revisions WHERE command_id = 'seed:public-workforce' AND resource_type = 'person';

INSERT INTO company_resource_revisions
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
SELECT 'organization:default', 'employee', employee.id, 1, 3, 'active',
  employment.hire_date, NULL,
  json_object('personId', 'person:seed:' || employee.id, 'employeeCode', employee.employee_code),
  'seed:public-workforce', '1', 'Confirmed development sample', 1767225600000
FROM company_employees employee
JOIN company_employments employment ON employment.employee_id = employee.id;

INSERT INTO company_resource_heads
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, updated_at)
SELECT organization_id, resource_type, resource_id, revision, organization_revision, state,
  effective_from, effective_to, attributes_json, recorded_at
FROM company_resource_revisions WHERE command_id = 'seed:public-workforce' AND resource_type = 'employee';

INSERT INTO company_workforce_resource_bindings
  (resource_type, resource_id, organization_id, employee_id, resource_revision,
   lifecycle_revision, last_action_id)
SELECT 'employee', employee.id, 'organization:default', employee.id, 1,
  lifecycle.revision, NULL
FROM company_employees employee
JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = employee.id;

INSERT INTO company_resource_revisions
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
SELECT 'organization:default', 'employment', employment.id, 1, 3, 'active',
  employment.hire_date, NULL,
  json_object('employeeId', employment.employee_id, 'status',
    CASE WHEN employment.status = 'TERMINATED' THEN 'ACTIVE' ELSE employment.status END,
    'employmentType', employment.employment_type, 'officialName', employment.contract_name),
  'seed:public-workforce', '1', 'Confirmed development sample', 1767225600000
FROM company_employments employment;

INSERT INTO company_resource_heads
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, updated_at)
SELECT organization_id, resource_type, resource_id, revision, organization_revision, state,
  effective_from, effective_to, attributes_json, recorded_at
FROM company_resource_revisions WHERE command_id = 'seed:public-workforce' AND resource_type = 'employment';

INSERT INTO company_workforce_resource_bindings
  (resource_type, resource_id, organization_id, employee_id, resource_revision,
   lifecycle_revision, last_action_id)
SELECT 'employment', employment.id, 'organization:default', employment.employee_id, 1,
  lifecycle.revision, NULL
FROM company_employments employment
JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = employment.employee_id;

INSERT INTO company_resource_revisions
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
SELECT 'organization:default', 'account-employee-link', 'link:seed:' || link.account_id, 1, 3,
  'active', employment.hire_date, NULL,
  json_object('accountId', link.account_id, 'employeeId', link.employee_id),
  'seed:public-workforce', '1', 'Confirmed development sample', 1767225600000
FROM company_account_employee_links link
JOIN company_employments employment ON employment.employee_id = link.employee_id;

INSERT INTO company_resource_heads
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, updated_at)
SELECT organization_id, resource_type, resource_id, revision, organization_revision, state,
  effective_from, effective_to, attributes_json, recorded_at
FROM company_resource_revisions
WHERE command_id = 'seed:public-workforce' AND resource_type = 'account-employee-link';

INSERT INTO company_account_employee_resource_bindings
  (resource_id, organization_id, account_id, employee_id, recorded_at)
SELECT head.resource_id, head.organization_id,
  json_extract(head.attributes_json, '$.accountId'),
  json_extract(head.attributes_json, '$.employeeId'), 1767225600000
FROM company_resource_heads head
WHERE head.resource_type = 'account-employee-link' AND head.organization_revision = 3;

UPDATE company_organizations SET revision = 3, updated_at = 1767225600000
WHERE id = 'organization:default' AND revision = 2;

-- 退職済みの架空従業員は、入社時の在籍と退職日からの状態を別版で残す。
INSERT INTO company_command_receipts
  (organization_id, command_id, fingerprint, expected_revision, organization_revision, recorded_at)
VALUES ('organization:default', 'seed:public-workforce-termination',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 3, 4, 1767225600000);

INSERT INTO company_resource_revisions
  (organization_id, resource_type, resource_id, revision, organization_revision, state,
   effective_from, effective_to, attributes_json, command_id, actor_account_id, reason, recorded_at)
SELECT 'organization:default', 'employment', id, 2, 4, 'active', termination_date,
  NULL, json_object('employeeId', employee_id, 'status', 'TERMINATED',
    'employmentType', employment_type, 'officialName', contract_name),
  'seed:public-workforce-termination', '1', 'Confirmed development sample', 1767225600000
FROM company_employments WHERE status = 'TERMINATED';

UPDATE company_resource_heads
SET revision = 2, organization_revision = 4, state = 'active',
  effective_from = (SELECT revision.effective_from FROM company_resource_revisions revision
    WHERE revision.organization_id = company_resource_heads.organization_id
      AND revision.resource_type = company_resource_heads.resource_type
      AND revision.resource_id = company_resource_heads.resource_id AND revision.revision = 2),
  attributes_json = (SELECT revision.attributes_json FROM company_resource_revisions revision
    WHERE revision.organization_id = company_resource_heads.organization_id
      AND revision.resource_type = company_resource_heads.resource_type
      AND revision.resource_id = company_resource_heads.resource_id AND revision.revision = 2),
  updated_at = 1767225600000
WHERE resource_type = 'employment' AND resource_id IN
  (SELECT id FROM company_employments WHERE status = 'TERMINATED');

UPDATE company_workforce_resource_bindings SET resource_revision = 2
WHERE resource_type = 'employment' AND resource_id IN
  (SELECT id FROM company_employments WHERE status = 'TERMINATED');

UPDATE company_organizations SET revision = 4, updated_at = 1767225600000
WHERE id = 'organization:default' AND revision = 3;
