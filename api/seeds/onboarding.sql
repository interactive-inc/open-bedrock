-- onboarding ドメインの seed
-- 対象テーブル: onboarding_templates, onboarding_template_tasks, onboarding_assignments, onboarding_tasks
-- migration: migrations/onboarding.sql
-- 値: src/infrastructure/seed/seed-onboarding-templates.ts,
--     src/infrastructure/seed/seed-onboarding-assignments.ts,
--     src/infrastructure/seed/seed-onboarding-tasks.ts
-- employees は employee ドメインが seed するため、このファイルでは扱わない

INSERT INTO onboarding_templates (id, code, name, kind, description) VALUES
  (1, 'engineer_join', 'Engineer Onboarding Checklist', 'join', 'Initial setup for new engineers'),
  (2, 'common_leave', 'Common Offboarding Checklist', 'leave', NULL);

INSERT INTO onboarding_template_tasks (template_code, code, title, sort_order, owner_role) VALUES
  ('engineer_join', 'issue_pc', 'Issue a laptop', 1, 'hr'),
  ('engineer_join', 'create_account', 'Create accounts', 2, 'admin'),
  ('common_leave', 'return_pc', 'Return the laptop', 1, 'hr');

INSERT INTO onboarding_assignments (id, employee_id, template_code, kind, status, assigned_at) VALUES
  (100, 5, 'engineer_join', 'join', 'in_progress', '2026-05-29T00:00:00Z');

INSERT INTO onboarding_tasks (id, assignment_id, template_task_code, title, sort_order, status, completed_at) VALUES
  (200, 100, 'issue_pc', 'Issue a laptop', 1, 'pending', NULL),
  (201, 100, 'create_account', 'Create accounts', 2, 'pending', NULL);
