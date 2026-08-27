-- budget ドメインの seed
-- 対象テーブル: expense_budgets
-- 値は Expense context の seed-budgets.repository.ts と一致させる。
-- 予算は Expense が所有し、Company organization unit code を参照する。

INSERT INTO expense_budgets (id, organization_unit_id, fiscal_period, period_start, period_end, amount, name, note, created_at) VALUES
  (1, 'department:D003', '2026', '2026-04-01', '2027-03-31', 1000000, '開発部 2026年度', '年間運用予算', '2026-04-01T00:00:00Z'),
  (2, 'department:D004', '2026', '2026-04-01', '2027-03-31', 500000, '営業部 2026年度', NULL, '2026-04-01T00:00:00Z');
