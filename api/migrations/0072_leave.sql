-- 休暇申請（本人の申請・承認/却下の記録）
CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  approver_id INTEGER,
  decided_comment TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests (employee_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests (status);

-- 年度ごとの休暇残数（付与・消化・残）
CREATE TABLE IF NOT EXISTS leave_balances (
  employee_id INTEGER NOT NULL,
  fiscal_year TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  granted_days INTEGER NOT NULL,
  used_days INTEGER NOT NULL,
  remaining_days INTEGER NOT NULL,
  PRIMARY KEY (employee_id, fiscal_year, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON leave_balances (employee_id, fiscal_year);
