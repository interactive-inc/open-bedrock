-- 懲戒の記録（非公開。本人にも見せない設計。判定は持たず事実の記録のみ）
CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disciplinary_actions_employee ON disciplinary_actions (employee_id);
