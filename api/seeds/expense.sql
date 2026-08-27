-- expense ドメインの seed
-- 対象テーブル: expenses, expense_approvals
-- 値は src/infrastructure/seed/seed-expenses.ts / seed-expense-approvals.ts と一致させる（テスト期待値と整合）。
-- employees は他ドメイン（employee）が seed するため含めない。

INSERT INTO expenses (id, employee_id, organization_unit_id, category, amount, spent_at, note, status, created_at) VALUES
  (1, '5', 'department:D003', 'transport', 1200, '2026-05-10', '取引先訪問', 'pending', '2026-05-11T01:00:00Z'),
  (2, '5', 'department:D003', 'books', 3300, '2026-05-12', NULL, 'approved', '2026-05-13T02:00:00Z'),
  (3, '10', 'department:D004', 'entertainment', 8800, '2026-05-14', 'チーム懇親会', 'pending', '2026-05-15T03:00:00Z');

-- expense_approvals は初期状態では承認記録なし（seed-expense-approvals.ts は空配列）。
