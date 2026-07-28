-- 表彰の記録（社内公開。判定や評価計算は持たず事実の記録のみ）
CREATE TABLE IF NOT EXISTS commendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  awarded_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commendations_employee ON commendations (employee_id);
