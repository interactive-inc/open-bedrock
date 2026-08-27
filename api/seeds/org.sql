-- Company organization は Unit、所属、責務を一つの原子的変更として初期化する。

INSERT INTO company_organization_change_operations (
  id, expected_revision, change_count, applied_count, resulting_revision, status,
  recorded_at, request_fingerprint, actor_account_id, reason, evidence_references_json
)
SELECT
  'initialization:company-organization',
  revision,
  26,
  0,
  revision + 26,
  'PENDING',
  1767225600000,
  '0000000000000000000000000000000000000000000000000000000000000000',
  'system:initialization',
  'Initialize Company organization',
  '[]'
FROM company_organization_lifecycle_states
WHERE id = 1;

INSERT INTO company_organization_units (id, created_at) VALUES
  ('department:D001', 1767225600000),
  ('department:D002', 1767225600000),
  ('department:D003', 1767225600000),
  ('department:D004', 1767225600000),
  ('department:D005', 1767225600000),
  ('department:D006', 1767225600000);

INSERT INTO company_organization_unit_period_versions (
  period_id, revision, organization_unit_id, code, official_name, kind,
  parent_organization_unit_id, starts_on, ends_on, is_void,
  recorded_by_action_id, recorded_at
)
VALUES
  ('department:D001:initial', 1, 'department:D001', 'D001', '経営企画部', 'DEPARTMENT', 'company:root', '2026-01-01', NULL, 0, 'initialization:company-organization', 1767225600000),
  ('department:D002:initial', 1, 'department:D002', 'D002', '人事部', 'DEPARTMENT', 'department:D001', '2026-01-01', NULL, 0, 'initialization:company-organization', 1767225600000),
  ('department:D003:initial', 1, 'department:D003', 'D003', '開発部', 'DEPARTMENT', 'department:D001', '2026-01-01', NULL, 0, 'initialization:company-organization', 1767225600000),
  ('department:D004:initial', 1, 'department:D004', 'D004', '営業部', 'DEPARTMENT', 'department:D001', '2026-01-01', NULL, 0, 'initialization:company-organization', 1767225600000),
  ('department:D005:initial', 1, 'department:D005', 'D005', 'カスタマーサクセス部', 'DEPARTMENT', 'department:D004', '2026-01-01', NULL, 0, 'initialization:company-organization', 1767225600000),
  ('department:D006:initial', 1, 'department:D006', 'D006', '総務部', 'DEPARTMENT', 'department:D001', '2026-01-01', NULL, 0, 'initialization:company-organization', 1767225600000);

WITH assignments(employee_id, department_code, position_title, manager_employee_id) AS (
  VALUES
    ('1', 'D001', '最高技術責任者', NULL),
    ('2', 'D002', '人事マネージャー', '1'),
    ('3', 'D002', '人事担当', '2'),
    ('4', 'D003', '開発マネージャー', '1'),
    ('5', 'D003', 'シニアエンジニア', '4'),
    ('6', 'D003', 'エンジニア', '4'),
    ('9', 'D004', '営業マネージャー', '1'),
    ('10', 'D004', '営業担当', '9'),
    ('13', 'D005', 'カスタマーサクセスマネージャー', '9'),
    ('15', 'D005', 'カスタマーサクセス担当', '13'),
    ('16', 'D006', '総務マネージャー', NULL),
    ('17', 'D002', '人事担当', '2'),
    ('99', 'D006', '総務担当', '16')
)
INSERT INTO company_organization_assignment_period_versions (
  period_id, revision, employment_id, employee_id, organization_unit_id,
  assignment_type, position_title, manager_employee_id, starts_on, ends_on,
  is_void, recorded_by_action_id, recorded_at
)
SELECT
  'assignment-period:seed-assignment-' || employee_id,
  1,
  'employment:seed-employment-' || employee_id,
  employee_id,
  'department:' || department_code,
  'PRIMARY',
  position_title,
  manager_employee_id,
  '2026-01-01',
  NULL,
  0,
  'initialization:company-organization',
  1767225600000
FROM assignments;

WITH managers(employee_id, department_code) AS (
  VALUES
    ('1', 'D001'),
    ('2', 'D002'),
    ('4', 'D003'),
    ('9', 'D004'),
    ('13', 'D005'),
    ('16', 'D006')
)
INSERT INTO company_organization_responsibility_period_versions (
  period_id, revision, employment_id, employee_id, organization_unit_id,
  responsibility_type, starts_on, ends_on, is_void,
  recorded_by_action_id, recorded_at
)
SELECT
  'responsibility-period:seed-responsibility-' || department_code,
  1,
  'employment:seed-employment-' || employee_id,
  employee_id,
  'department:' || department_code,
  'MANAGER',
  '2026-01-01',
  NULL,
  0,
  'initialization:company-organization',
  1767225600000
FROM managers;

INSERT INTO company_organization_responsibility_period_versions (
  period_id, revision, employment_id, employee_id, organization_unit_id,
  responsibility_type, starts_on, ends_on, is_void,
  recorded_by_action_id, recorded_at
)
VALUES (
  'responsibility-period:people-operations:3',
  1,
  'employment:seed-employment-3',
  '3',
  'department:D002',
  'PEOPLE_OPERATIONS',
  '2026-01-01',
  NULL,
  0,
  'initialization:company-organization',
  1767225600000
);

UPDATE company_organization_change_operations
SET status = 'COMPLETED'
WHERE id = 'initialization:company-organization';
