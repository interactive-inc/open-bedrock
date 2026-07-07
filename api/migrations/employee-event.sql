-- 異動・在籍イベント履歴（入社・異動・休職・復職・退職）。判定は持たず事実の記録のみ。
CREATE TABLE IF NOT EXISTS employee_events (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  from_department_code TEXT,
  to_department_code TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_events_employee ON employee_events (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_events_kind ON employee_events (kind);
