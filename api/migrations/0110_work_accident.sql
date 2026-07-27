-- 労災・事故の発生記録。起きた事実の時系列記録のみ（記録）。法的な労災認定判定はしない。
-- employee_id は NULL 可（対象者が特定されない事故もあるため）。
CREATE TABLE IF NOT EXISTS work_accidents (
  id INTEGER PRIMARY KEY,
  occurred_on TEXT NOT NULL,
  employee_id INTEGER,
  location TEXT,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_accidents_occurred_on ON work_accidents (occurred_on);

CREATE INDEX IF NOT EXISTS idx_work_accidents_employee ON work_accidents (employee_id);
