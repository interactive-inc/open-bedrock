-- 従業員台帳（employee ドメイン）
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  dept_id INTEGER,
  dept_name TEXT,
  position TEXT,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_code ON employees (code);

CREATE INDEX IF NOT EXISTS idx_employees_email ON employees (email);
