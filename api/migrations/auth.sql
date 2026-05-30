-- 認証ドメインは専用テーブルを持たず、従業員台帳（employees）を土台にする。
-- employees 本体の定義は 0001_org_and_employee.sql が持つ。ここではログイン照合と
-- 本人取得に使うキーのインデックスのみを idempotent に定義する。

-- ログインはメールアドレスを大文字小文字を無視して照合する（LOWER(email)）。
CREATE INDEX IF NOT EXISTS idx_employees_email_lower ON employees (LOWER(email));

-- /me は token の employeeId（= employees.id）で本人を引く。id は PK なので追加索引は不要。
