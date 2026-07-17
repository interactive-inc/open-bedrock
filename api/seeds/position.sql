-- position ドメインの seed（役職マスタ）。
-- migration position.sql 適用後の positions へ INSERT する。
-- 値は src/infrastructure/seed/seed-positions.ts と一致させる（テスト期待値と整合）。
-- name は seeds/employee.sql の employees.position と一致させ、発令・登録の code 参照で解決される先にする。

INSERT INTO positions (id, code, name, rank, description, created_at) VALUES
  (1, 'CTO', 'CTO', 1, 'Chief Technology Officer', '2026-01-01T00:00:00.000Z'),
  (2, 'HR_MANAGER', 'HR Manager', 2, NULL, '2026-01-01T00:00:00.000Z'),
  (3, 'ENGINEERING_MANAGER', 'Engineering Manager', 3, NULL, '2026-01-01T00:00:00.000Z'),
  (4, 'SALES_MANAGER', 'Sales Manager', 4, NULL, '2026-01-01T00:00:00.000Z'),
  (5, 'CS_MANAGER', 'CS Manager', 5, NULL, '2026-01-01T00:00:00.000Z'),
  (6, 'ADMIN_MANAGER', 'Admin Manager', 6, NULL, '2026-01-01T00:00:00.000Z'),
  (7, 'SENIOR_ENGINEER', 'Senior Engineer', 7, NULL, '2026-01-01T00:00:00.000Z'),
  (8, 'ENGINEER', 'Engineer', 8, NULL, '2026-01-01T00:00:00.000Z'),
  (9, 'HR_STAFF', 'HR Staff', 9, NULL, '2026-01-01T00:00:00.000Z'),
  (10, 'SALES_STAFF', 'Sales Staff', 10, NULL, '2026-01-01T00:00:00.000Z'),
  (11, 'CS_STAFF', 'CS Staff', 11, NULL, '2026-01-01T00:00:00.000Z'),
  (12, 'ADMIN_STAFF', 'Admin Staff', 12, NULL, '2026-01-01T00:00:00.000Z');
