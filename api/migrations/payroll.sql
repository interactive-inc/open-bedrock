-- 給与明細（社員ごと・期間ごとの支給/控除/差引支給額）
CREATE TABLE IF NOT EXISTS payslips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  period TEXT NOT NULL,
  base_salary INTEGER NOT NULL,
  allowances INTEGER NOT NULL,
  deductions INTEGER NOT NULL,
  net_pay INTEGER NOT NULL,
  issued_at TEXT,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips (employee_id);

CREATE INDEX IF NOT EXISTS idx_payslips_employee_period ON payslips (employee_id, period);

-- 給与改定の履歴（基本給の改定・前回基本給・適用日）
CREATE TABLE IF NOT EXISTS salary_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  previous_base_salary INTEGER NOT NULL,
  new_base_salary INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salary_revisions_employee ON salary_revisions (employee_id);
