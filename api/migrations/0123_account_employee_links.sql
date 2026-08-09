-- System Account と Company Employee の対応を Company 所有の link table へ移す。
-- 認証主体と会社内の人物を別ライフサイクルにし、System schema から employee 語彙を除く。

CREATE TABLE account_employee_links (
  account_id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL UNIQUE
);

CREATE INDEX idx_account_employee_links_employee
  ON account_employee_links (employee_id);

INSERT INTO account_employee_links (account_id, employee_id)
SELECT id, employee_id
FROM accounts
WHERE employee_id IS NOT NULL;

CREATE TABLE accounts_without_employee (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO accounts_without_employee (
  id,
  status,
  token_version,
  created_at,
  updated_at
)
SELECT
  id,
  status,
  token_version,
  created_at,
  updated_at
FROM accounts;

DROP TABLE accounts;
ALTER TABLE accounts_without_employee RENAME TO accounts;

CREATE TABLE cli_login_codes_without_employee (
  code_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

INSERT INTO cli_login_codes_without_employee (
  code_hash,
  account_id,
  expires_at
)
SELECT
  code_hash,
  account_id,
  expires_at
FROM cli_login_codes;

DROP TABLE cli_login_codes;
ALTER TABLE cli_login_codes_without_employee RENAME TO cli_login_codes;

CREATE INDEX idx_cli_login_codes_expires ON cli_login_codes (expires_at);

CREATE TABLE browser_login_codes_without_employee (
  code_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

INSERT INTO browser_login_codes_without_employee (
  code_hash,
  account_id,
  expires_at
)
SELECT
  code_hash,
  account_id,
  expires_at
FROM browser_login_codes;

DROP TABLE browser_login_codes;
ALTER TABLE browser_login_codes_without_employee RENAME TO browser_login_codes;

CREATE INDEX idx_browser_login_codes_expires ON browser_login_codes (expires_at);

INSERT INTO permissions (id, key, description, category)
SELECT COALESCE(MAX(id), 0) + 1, 'system:admin', 'System全体を管理する', 'system'
FROM permissions;

INSERT INTO permissions (id, key, description, category)
SELECT COALESCE(MAX(id), 0) + 1, 'iam:read', 'IAM設定と割当を閲覧する', 'iam'
FROM permissions;

INSERT INTO permissions (id, key, description, category)
SELECT COALESCE(MAX(id), 0) + 1, 'iam:write', 'IAM設定と割当を変更する', 'iam'
FROM permissions;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role, permissions permission
WHERE role.key = 'root'
  AND role.is_system = 1
  AND permission.key IN ('system:admin', 'iam:read', 'iam:write');
