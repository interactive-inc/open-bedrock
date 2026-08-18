-- 未運用baselineをcanonical System runtimeへ確定する。
-- 以後はsystem_* tableだけを読み書きする。

-- 運用データではなく、コードで管理してきた4つのmanaged role catalogだけを正規Systemへ確定する。
INSERT INTO system_iam_roles (id, key, kind, name, description, created_at, updated_at)
SELECT CAST(id AS TEXT), 'company:' || key, 'managed', name, description, 0, 0
FROM roles
WHERE is_system = 1;

INSERT INTO system_iam_role_permissions (role_id, permission_key)
SELECT CAST(role_permission.role_id AS TEXT), permission.key
FROM role_permissions AS role_permission
INNER JOIN roles AS role ON role.id = role_permission.role_id AND role.is_system = 1
INNER JOIN permissions AS permission ON permission.id = role_permission.permission_id;

DROP TABLE identity_login_tokens;
DROP TABLE cli_login_codes;
DROP TABLE cli_login_states;
DROP TABLE browser_login_codes;
DROP TABLE batch_jobs;

DROP TABLE account_employee_links;

CREATE TABLE account_employee_links (
  account_id TEXT PRIMARY KEY NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL UNIQUE
    REFERENCES employees(id) ON DELETE RESTRICT
);

CREATE INDEX idx_account_employee_links_employee
  ON account_employee_links (employee_id);

DROP TABLE refresh_tokens;
DROP TABLE notifications;
DROP TABLE account_roles;
DROP TABLE role_permissions;
DROP TABLE permissions;
DROP TABLE roles;
DROP TABLE identities;
DROP TABLE accounts;
