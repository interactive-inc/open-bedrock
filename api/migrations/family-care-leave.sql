-- 産休・育休・介護休業の申出（期限管理と記録。給付金額の計算は持たない）
CREATE TABLE IF NOT EXISTS family_care_leaves (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  leave_kind TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_family_care_leaves_employee ON family_care_leaves (employee_id);
