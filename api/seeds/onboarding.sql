-- onboarding ドメインの seed
-- 対象テーブル: onboarding_templates, onboarding_template_tasks, onboarding_assignments, onboarding_tasks
-- migration: migrations/onboarding.sql
-- 値: src/infrastructure/seed/seed-onboarding-templates.ts,
--     src/infrastructure/seed/seed-onboarding-assignments.ts,
--     src/infrastructure/seed/seed-onboarding-tasks.ts
-- employees は employee ドメインが seed するため、このファイルでは扱わない

INSERT INTO onboarding_templates (id, code, name, kind, description) VALUES
  ('0190003c-0000-7000-8000-000000000001', 'engineer_join', 'エンジニア入社チェックリスト', 'join', '新入エンジニアの初期セットアップ'),
  ('0190003c-0000-7000-8000-000000000002', 'common_leave', '共通退職チェックリスト', 'leave', NULL);

INSERT INTO onboarding_template_tasks (id, template_code, code, title, sort_order, owner_role) VALUES
  ('01900038-0000-7000-8000-000000000001', 'engineer_join', 'issue_pc', 'PCを貸与する', 1, 'hr'),
  ('01900038-0000-7000-8000-000000000002', 'engineer_join', 'create_account', '各種アカウントを作成する', 2, 'root'),
  ('01900038-0000-7000-8000-000000000003', 'common_leave', 'return_pc', 'PCを返却する', 1, 'hr');

INSERT INTO onboarding_assignments (id, employee_id, template_code, kind, status, assigned_at) VALUES
  ('0190003d-0000-7000-8000-000000000064', '01900062-0000-7000-8000-000000000005', 'engineer_join', 'join', 'in_progress', '2026-05-29T00:00:00Z');

INSERT INTO onboarding_tasks (id, assignment_id, template_task_code, title, sort_order, status, completed_at) VALUES
  ('0190003e-0000-7000-8000-0000000000c8', '0190003d-0000-7000-8000-000000000064', 'issue_pc', 'PCを貸与する', 1, 'pending', NULL),
  ('0190003e-0000-7000-8000-0000000000c9', '0190003d-0000-7000-8000-000000000064', 'create_account', '各種アカウントを作成する', 2, 'pending', NULL);
