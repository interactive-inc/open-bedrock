-- budget ドメインの seed
-- 対象テーブル: budgets
-- 値は src/infrastructure/seed/seed-budgets.ts と一致させる（テスト期待値と整合）。
-- departments は他ドメイン（org）が seed するため含めない。

INSERT INTO department_budgets (id, department_id, fiscal_period, period_start, period_end, amount, name, note, created_at) VALUES
  (1, 3, '2026', '2026-04-01', '2027-03-31', 1000000, 'Engineering FY2026', 'annual operating budget', '2026-04-01T00:00:00Z'),
  (2, 4, '2026', '2026-04-01', '2027-03-31', 500000, 'Sales FY2026', NULL, '2026-04-01T00:00:00Z');
