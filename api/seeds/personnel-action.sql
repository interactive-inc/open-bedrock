-- personnel-action ドメインの seed
-- 対象テーブル: application_requests, application_subjects, personnel_action_requests
-- 人事発令申請は application（テンプレート 900000001 = personnel_action_request、migration 0038 で投入済み）
-- に紐づく。application.sql の id (1-5) と衝突しないよう 9001 番台を使う。
-- payload_json は personnelActionInputSchema（strict）を満たす形にすること。
-- personnel_action_requests.created_at は unix 秒（integer）。

INSERT INTO application_requests (id, template_id, applicant_id, status, current_step, payload, created_at) VALUES
  (9001, 900000001, 2, 'pending', 'hr_approval', '{}', '2026-08-01T01:00:00Z');

INSERT INTO application_subjects (application_id, subject_type, subject_employee_id, subject_snapshot_json, target_department_code) VALUES
  (9001, 'employee', 10, NULL, NULL);

-- E010 を営業部から CS 部へ異動させる申請（承認待ち）。
INSERT INTO personnel_action_requests (id, application_id, target_employee_id, kind, payload_json, requested_by_employee_id, base_employee_revision, base_organization_revision, created_at, applied_action_id, withdrawn_at, withdrawn_by_employee_id) VALUES
  ('00000000-0000-4000-8000-000000009001', 9001, 10, 'transferred', '{"kind":"transferred","employeeCode":"E010","eventOn":"2026-09-01","departmentCode":"D005","positionTitle":null,"managerEmployeeCode":"E013"}', 2, 0, 0, 1785546000, NULL, NULL, NULL);
