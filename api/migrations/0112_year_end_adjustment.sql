-- 年末調整の申告受付（提出状況の記録のみ。税額の計算や判定は持たない）
CREATE TABLE IF NOT EXISTS year_end_adjustments (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  target_year INTEGER NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_year_end_adjustments_employee ON year_end_adjustments (employee_id);
