-- 資格・免許マスタ（コード・名称・発行元・説明）。会社で管理対象とする資格の台帳。
CREATE TABLE IF NOT EXISTS certifications (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  issuer TEXT,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_certifications_code ON certifications (code);

-- 従業員の資格保有記録（取得日・有効期限つき）。更新要否の判定はしない（台帳）。
CREATE TABLE IF NOT EXISTS employee_certifications (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  certification_id INTEGER NOT NULL,
  acquired_on TEXT NOT NULL,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_certifications_employee ON employee_certifications (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_certifications_certification ON employee_certifications (certification_id);

-- 同一従業員・同一資格・同一取得日の重複記録を DB レベルで防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_certifications_unique
  ON employee_certifications (employee_id, certification_id, acquired_on);
