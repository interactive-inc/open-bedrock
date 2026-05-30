-- goal ドメインの seed
-- 対象テーブル: goals, goal_evaluations
-- migration: migrations/goal.sql / 値: src/infrastructure/seed/seed-goals.ts, seed-goal-evaluations.ts

INSERT INTO goals (id, employee_id, period, title, kpi, weight, status) VALUES
  (1, 5, '2026-H1', 'Release the new dashboard feature', 'Released with zero critical bugs', 40, 'in_progress'),
  (2, 5, '2026-H1', 'Reduce code review turnaround time', 'Average response within 4 hours', 20, 'in_progress'),
  (3, 9, '2026-H1', 'Improve test coverage', 'Coverage at or above 80%', 30, 'in_progress'),
  (4, 9, '2025-H2', 'Set up the CI/CD pipeline', 'Deployment fully automated', 50, 'completed'),
  (5, 10, '2026-H1', 'Acquire ten new customers', 'Ten signed deals', 60, 'in_progress'),
  (6, 10, '2026-H1', 'Lower the churn rate of existing customers', 'Churn rate below 5%', 20, 'draft'),
  (7, 13, '2026-H1', 'Refresh the onboarding material', 'Material renewal completed', 30, 'in_progress'),
  (8, 3, '2026-H1', 'Improve the hiring process', 'Screening lead time cut by 30%', 40, 'draft');

INSERT INTO goal_evaluations (id, goal_id, evaluator_id, kind, score, comment, created_at) VALUES
  (1, 4, 9, 'self', 90, 'Automation completed as planned', '2026-01-10T09:00:00Z'),
  (2, 4, 4, 'manager', 85, 'Quality stayed stable; strong result', '2026-01-15T09:00:00Z'),
  (3, 4, 4, 'final', 88, 'Final rating A', '2026-01-20T09:00:00Z');
