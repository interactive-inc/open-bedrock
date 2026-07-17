-- position ドメインの seed（役職マスタ）
-- migration position.sql 適用後の positions へ INSERT する。
-- 値は src/infrastructure/seed/seed-positions.ts と一致させる(テスト期待値と整合)。

INSERT INTO positions (id, code, name, rank, description, created_at) VALUES
  (1, 'CTO', 'CTO', 1, 'Chief Technology Officer', '2026-01-01T00:00:00.000Z'),
  (2, 'HR_MGR', 'HR Manager', 2, NULL, '2026-01-01T00:00:00.000Z'),
  (3, 'HR_STAFF', 'HR Staff', 3, NULL, '2026-01-01T00:00:00.000Z'),
  (4, 'ENG_MGR', 'Engineering Manager', 4, NULL, '2026-01-01T00:00:00.000Z'),
  (5, 'SR_ENG', 'Senior Engineer', 5, NULL, '2026-01-01T00:00:00.000Z'),
  (6, 'ENG', 'Engineer', 6, NULL, '2026-01-01T00:00:00.000Z'),
  (7, 'SALES_MGR', 'Sales Manager', 7, NULL, '2026-01-01T00:00:00.000Z'),
  (8, 'SALES_STAFF', 'Sales Staff', 8, NULL, '2026-01-01T00:00:00.000Z'),
  (9, 'CS_MGR', 'CS Manager', 9, NULL, '2026-01-01T00:00:00.000Z'),
  (10, 'CS_STAFF', 'CS Staff', 10, NULL, '2026-01-01T00:00:00.000Z'),
  (11, 'ADMIN_MGR', 'Admin Manager', 11, NULL, '2026-01-01T00:00:00.000Z'),
  (12, 'ADMIN_STAFF', 'Admin Staff', 12, NULL, '2026-01-01T00:00:00.000Z');
