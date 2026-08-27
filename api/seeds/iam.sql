-- canonical System IAM seed。AccountとEmployeeは別identityとしてCompanyのlinkだけで対応する。
-- 平文パスワードは全員 "password"（seed-password-hash.tsと同じ固定salt PBKDF2）。

INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES
  ('1', 'active', 0, 0, 0),
  ('2', 'active', 0, 0, 0),
  ('3', 'active', 0, 0, 0),
  ('4', 'active', 0, 0, 0),
  ('5', 'active', 0, 0, 0),
  ('9', 'active', 0, 0, 0),
  ('10', 'active', 0, 0, 0),
  ('13', 'active', 0, 0, 0),
  ('16', 'active', 0, 0, 0);

INSERT INTO company_account_employee_links (account_id, employee_id) VALUES
  ('1', '1'),
  ('2', '2'),
  ('3', '3'),
  ('4', '4'),
  ('5', '5'),
  ('9', '9'),
  ('10', '10'),
  ('13', '13'),
  ('16', '16');

INSERT INTO company_account_profiles
  (organization_id, account_id, display_name, created_at, updated_at)
SELECT 'organization:default', link.account_id, employee.official_name, 0, 0
FROM company_account_employee_links link
INNER JOIN company_employees employee ON employee.id = link.employee_id;

INSERT INTO system_identity_bindings
  (id, account_id, provider, subject, created_at, activated_at, revoked_at)
VALUES
  ('password:1', '1', 'password', 'you+e001@example.com', 0, 0, NULL),
  ('password:2', '2', 'password', 'you+e002@example.com', 0, 0, NULL),
  ('password:3', '3', 'password', 'you+e003@example.com', 0, 0, NULL),
  ('password:4', '4', 'password', 'you+e004@example.com', 0, 0, NULL),
  ('password:5', '5', 'password', 'you+e005@example.com', 0, 0, NULL),
  ('password:9', '9', 'password', 'you+e009@example.com', 0, 0, NULL),
  ('password:10', '10', 'password', 'you+e010@example.com', 0, 0, NULL),
  ('password:13', '13', 'password', 'you+e013@example.com', 0, 0, NULL),
  ('password:16', '16', 'password', 'you+e016@example.com', 0, 0, NULL);

INSERT INTO system_identity_profiles (identity_id, email, email_verified, last_used_at, updated_at)
SELECT id, subject, 1, NULL, 0
FROM system_identity_bindings
WHERE provider = 'password';

INSERT INTO system_password_credentials
  (identity_id, password_hash, changed_at, created_at, updated_at)
SELECT
  id,
  'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=',
  0,
  0,
  0
FROM system_identity_bindings
WHERE provider = 'password';

-- E001=root、E003=hr、E002/E004=manager、その他=member。
INSERT INTO system_role_bindings
  (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
SELECT
  'seed:' || account.id || ':' || role.id,
  account.id,
  role.id,
  NULL,
  NULL,
  0,
  NULL
FROM system_accounts account
JOIN system_iam_roles role ON role.kind = 'managed' AND role.key = 'company:' || (
  CASE
    WHEN account.id = '1' THEN 'root'
    WHEN account.id = '3' THEN 'hr'
    WHEN account.id IN ('2', '4') THEN 'manager'
    ELSE 'member'
  END
)
WHERE account.id IN ('1', '2', '3', '4', '5', '9', '10', '13', '16');
