-- 等級マスタ（並び順の rank を持つ等級の定義）。判定・計算は持たず定義のみ。
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

-- 等級コードは全社で一意（同一コードの二重登録を防ぐ）。
CREATE UNIQUE INDEX IF NOT EXISTS uq_grades_code ON grades (code);

-- 等級の割当履歴（社員ごとに、いつからどの等級か）。事実の記録のみ。
CREATE TABLE IF NOT EXISTS employee_grades (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  grade_id INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_grades_employee ON employee_grades (employee_id);

-- 同一社員・同一発効日の割当の重複を DB レベルで防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_grades_employee_effective_date
  ON employee_grades (employee_id, effective_date);
