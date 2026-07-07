-- 従業員の勤務形態の期間つき記録（regular / flextime / discretionary / shift）。制度の適法性判定はしない。事実の記録のみ。
CREATE TABLE IF NOT EXISTS employee_work_styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  style TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_work_styles_employee ON employee_work_styles (employee_id);
