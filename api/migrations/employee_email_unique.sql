-- employees.email に UNIQUE 制約を追加し、重複メールアドレスを DB レベルで防止する。
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique
  ON employees (email);
