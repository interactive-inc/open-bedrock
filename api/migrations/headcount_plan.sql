-- 人員計画（年度・部署ごとの計画人数。実在籍数との比較は API 側で active 数を添える）
CREATE TABLE IF NOT EXISTS headcount_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year INTEGER NOT NULL,
  department_code TEXT,
  planned_count INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

-- 同一年度・同一部署の二重登録を DB レベルで防ぐ（TOCTOU 対策の UNIQUE）。
CREATE UNIQUE INDEX IF NOT EXISTS uq_headcount_plans_year_department
  ON headcount_plans (fiscal_year, department_code);
