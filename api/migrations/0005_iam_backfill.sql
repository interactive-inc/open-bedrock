-- IAM Phase 2: 既存 employees から accounts / identities / account_roles を 1:1 生成(冪等)。
-- employees.role 由来の system role を account_roles に付与し、password_hash を identity.secret へ複製する。
-- INSERT OR IGNORE + NOT EXISTS 相当で二重実行しても差分ゼロ。employees 列はこの段階では残置。

-- 各 employee に accounts を 1 行(status=active, token_version=0)。employee_id 部分 unique で二重生成を防ぐ。
INSERT OR IGNORE INTO accounts (employee_id, status, token_version, created_at, updated_at)
  SELECT e.id, 'active', 0, 0, 0
  FROM employees e
  WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.employee_id = e.id);

-- 各 account に password identity を 1 行。subject=正規化 email(小文字)、secret=既存 password_hash。
-- (provider, subject) unique で二重生成を防ぐ。
INSERT OR IGNORE INTO identities (account_id, provider, subject, secret, email, email_verified, created_at)
  SELECT a.id, 'password', lower(e.email), e.password_hash, e.email, 1, 0
  FROM employees e
  JOIN accounts a ON a.employee_id = e.id
  WHERE NOT EXISTS (
    SELECT 1 FROM identities i WHERE i.provider = 'password' AND i.subject = lower(e.email)
  );

-- employees.role に対応する system role を account_roles に付与。複合 PK で冪等。
INSERT OR IGNORE INTO account_roles (account_id, role_id, granted_by, granted_at)
  SELECT a.id, r.id, NULL, 0
  FROM employees e
  JOIN accounts a ON a.employee_id = e.id
  JOIN roles r ON r.key = e.role AND r.is_system = 1;
