-- 部署マスタ（id と表示名）
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

-- 組織図上の部署ノード（親子・表示順・部署長）
CREATE TABLE IF NOT EXISTS org_departments (
  code TEXT PRIMARY KEY,
  department_id INTEGER NOT NULL,
  parent_code TEXT,
  manager_employee_code TEXT,
  sort_order INTEGER NOT NULL
);

-- 部署への所属（社員ごとの所属部署と直属マネージャー）
CREATE TABLE IF NOT EXISTS org_memberships (
  department_code TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  manager_employee_code TEXT,
  PRIMARY KEY (department_code, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_employee ON org_memberships (employee_code);
