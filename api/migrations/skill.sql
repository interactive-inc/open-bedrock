-- スキルマスタ（コード・表示名・カテゴリ）
CREATE TABLE IF NOT EXISTS skills (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills (category);

-- 従業員ごとの登録スキル（レベル・経験年数・補足）
CREATE TABLE IF NOT EXISTS employee_skills (
  employee_id INTEGER NOT NULL,
  skill_code TEXT NOT NULL,
  level INTEGER NOT NULL,
  years INTEGER,
  note TEXT,
  PRIMARY KEY (employee_id, skill_code)
);

CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON employee_skills (employee_id);
