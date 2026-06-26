-- IAM Phase 7: employees を純台帳に戻す。
-- 認証(email/password)は identities、認可(role)は account_roles が正となり、
-- employees.email / password_hash / role は不要になった。
-- 前提: 0005_iam_backfill.sql が email/password_hash/role を IAM(identities/account_roles)へ
-- 複製済みであること。このファイルより後(アルファベット順の named migration)では
-- これら 3 列・関連インデックスを参照しないこと(auth.sql / employee_email_unique.sql は無効化済み)。

-- 列に張られたインデックスを先に破棄する(SQLite は索引付き列を DROP COLUMN できない)。
DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_employees_email_unique;
DROP INDEX IF EXISTS idx_employees_email_lower;

-- 認証・認可の正は IAM。台帳から 3 列を破棄する。
ALTER TABLE employees DROP COLUMN role;
ALTER TABLE employees DROP COLUMN password_hash;
ALTER TABLE employees DROP COLUMN email;
