-- 退職申請（申出の受付から書類交付までの記録。法的判定は持たず記録のみ）
CREATE TABLE IF NOT EXISTS resignations (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  resignation_date TEXT NOT NULL,
  last_working_date TEXT,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resignations_employee ON resignations (employee_id);
