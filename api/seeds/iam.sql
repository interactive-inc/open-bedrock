-- canonical System IAM seed。AccountとEmployeeは別identityとしてCompanyのlinkだけで対応する。
-- 平文パスワードは全員 "password"。local seed専用pepperと16 byte固定saltで生成する。

INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES
  ('01900061-0000-7000-8000-000000000001', 'active', 0, 0, 0),
  ('01900061-0000-7000-8000-000000000002', 'active', 0, 0, 0),
  ('01900061-0000-7000-8000-000000000003', 'active', 0, 0, 0),
  ('01900061-0000-7000-8000-000000000004', 'active', 0, 0, 0),
  ('01900061-0000-7000-8000-000000000005', 'active', 0, 0, 0),
  ('01900061-0000-7000-8000-000000000009', 'active', 0, 0, 0),
  ('01900061-0000-7000-8000-00000000000a', 'active', 0, 0, 0),
  ('01900061-0000-7000-8000-00000000000d', 'active', 0, 0, 0),
  ('01900061-0000-7000-8000-000000000010', 'active', 0, 0, 0);

INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at) VALUES
  ('01900063-0000-7000-8000-000000000001', '01900061-0000-7000-8000-000000000001', 'human', 'Employee 1', 1, 0, 0),
  ('01900063-0000-7000-8000-000000000002', '01900061-0000-7000-8000-000000000002', 'human', 'Employee 2', 1, 0, 0),
  ('01900063-0000-7000-8000-000000000003', '01900061-0000-7000-8000-000000000003', 'human', 'Employee 3', 1, 0, 0),
  ('01900063-0000-7000-8000-000000000004', '01900061-0000-7000-8000-000000000004', 'human', 'Employee 4', 1, 0, 0),
  ('01900063-0000-7000-8000-000000000005', '01900061-0000-7000-8000-000000000005', 'human', 'Employee 5', 1, 0, 0),
  ('01900063-0000-7000-8000-000000000009', '01900061-0000-7000-8000-000000000009', 'human', 'Employee 9', 1, 0, 0),
  ('01900063-0000-7000-8000-00000000000a', '01900061-0000-7000-8000-00000000000a', 'human', 'Employee 10', 1, 0, 0),
  ('01900063-0000-7000-8000-00000000000d', '01900061-0000-7000-8000-00000000000d', 'human', 'Employee 13', 1, 0, 0),
  ('01900063-0000-7000-8000-000000000010', '01900061-0000-7000-8000-000000000010', 'human', 'Employee 16', 1, 0, 0);

INSERT INTO company_account_employee_links (account_id, employee_id) VALUES
  ('01900061-0000-7000-8000-000000000001', '01900062-0000-7000-8000-000000000001'),
  ('01900061-0000-7000-8000-000000000002', '01900062-0000-7000-8000-000000000002'),
  ('01900061-0000-7000-8000-000000000003', '01900062-0000-7000-8000-000000000003'),
  ('01900061-0000-7000-8000-000000000004', '01900062-0000-7000-8000-000000000004'),
  ('01900061-0000-7000-8000-000000000005', '01900062-0000-7000-8000-000000000005'),
  ('01900061-0000-7000-8000-000000000009', '01900062-0000-7000-8000-000000000009'),
  ('01900061-0000-7000-8000-00000000000a', '01900062-0000-7000-8000-00000000000a'),
  ('01900061-0000-7000-8000-00000000000d', '01900062-0000-7000-8000-00000000000d'),
  ('01900061-0000-7000-8000-000000000010', '01900062-0000-7000-8000-000000000010');

INSERT INTO company_account_profiles
  (organization_id, account_id, display_name, created_at, updated_at)
SELECT 'ad4f6cb1-774b-43ae-950f-80e9bc67c66d', link.account_id, employee.official_name, 0, 0
FROM company_account_employee_links link
INNER JOIN company_employees employee ON employee.id = link.employee_id;

INSERT INTO system_identity_bindings
  (id, account_id, provider, subject, created_at, activated_at, revoked_at)
VALUES
  ('0190006a-0000-7000-8000-000000000001', '01900061-0000-7000-8000-000000000001', 'password', 'you+e001@example.com', 0, 0, NULL),
  ('0190006a-0000-7000-8000-000000000002', '01900061-0000-7000-8000-000000000002', 'password', 'you+e002@example.com', 0, 0, NULL),
  ('0190006a-0000-7000-8000-000000000003', '01900061-0000-7000-8000-000000000003', 'password', 'you+e003@example.com', 0, 0, NULL),
  ('0190006a-0000-7000-8000-000000000004', '01900061-0000-7000-8000-000000000004', 'password', 'you+e004@example.com', 0, 0, NULL),
  ('0190006a-0000-7000-8000-000000000005', '01900061-0000-7000-8000-000000000005', 'password', 'you+e005@example.com', 0, 0, NULL),
  ('0190006a-0000-7000-8000-000000000009', '01900061-0000-7000-8000-000000000009', 'password', 'you+e009@example.com', 0, 0, NULL),
  ('0190006a-0000-7000-8000-00000000000a', '01900061-0000-7000-8000-00000000000a', 'password', 'you+e010@example.com', 0, 0, NULL),
  ('0190006a-0000-7000-8000-00000000000d', '01900061-0000-7000-8000-00000000000d', 'password', 'you+e013@example.com', 0, 0, NULL),
  ('0190006a-0000-7000-8000-000000000010', '01900061-0000-7000-8000-000000000010', 'password', 'you+e016@example.com', 0, 0, NULL);

INSERT INTO system_identity_profiles (identity_id, email, email_verified, last_used_at, updated_at)
SELECT id, subject, 1, NULL, 0
FROM system_identity_bindings
WHERE provider = 'password';

INSERT INTO system_password_credentials
  (identity_id, password_hash, changed_at, created_at, updated_at)
SELECT
  id,
  'pbkdf2$sha256$100000$b3Blbi1rYXJ0ZS1zZWVkIQ==$sYkpSyzEAo8/92M5Kp/hy+SXkV6on7BZn92/QejpyKw=',
  0,
  0,
  0
FROM system_identity_bindings
WHERE provider = 'password';

-- E001=root、E003=hr、E002/E004=manager、その他=member。割当の id は Account ごとに決まった UUID にする。
INSERT INTO system_role_bindings
  (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
SELECT
  '01900056' || substr(account.id, 9),
  account.id,
  role.id,
  NULL,
  NULL,
  0,
  NULL
FROM system_accounts account
JOIN system_iam_roles role ON role.kind = 'managed' AND role.key = 'company:' || (
  CASE
    WHEN account.id = '01900061-0000-7000-8000-000000000001' THEN 'root'
    WHEN account.id = '01900061-0000-7000-8000-000000000003' THEN 'hr'
    WHEN account.id IN ('01900061-0000-7000-8000-000000000002', '01900061-0000-7000-8000-000000000004') THEN 'manager'
    ELSE 'member'
  END
)
WHERE account.id IN ('01900061-0000-7000-8000-000000000001', '01900061-0000-7000-8000-000000000002', '01900061-0000-7000-8000-000000000003', '01900061-0000-7000-8000-000000000004', '01900061-0000-7000-8000-000000000005', '01900061-0000-7000-8000-000000000009', '01900061-0000-7000-8000-00000000000a', '01900061-0000-7000-8000-00000000000d', '01900061-0000-7000-8000-000000000010');
