-- 経費申請（申請者・カテゴリ・金額・ステータス）
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  spent_at TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expenses (employee_id);

CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (status);

-- 経費への承認/却下アクションの記録
CREATE TABLE IF NOT EXISTS expense_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  approver_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expense_approvals_expense ON expense_approvals (expense_id);
