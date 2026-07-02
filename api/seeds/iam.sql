-- IAM ドメインの seed(認証・認可の正)
-- 認証(email/password)は identities、認可(role)は account_roles。
-- employees は純台帳になったため(0006)、ここで accounts/identities/account_roles を直接投入する。
-- account.id = employee.id に固定し、トークンの accountId と employeeId を揃える(dev の利便性)。
-- 平文パスワードは全員 "password"(seed-password-hash.ts と同一の固定ソルト PBKDF2)。
-- 値は src/infrastructure/seed/seed-employees.ts / seeds/employee.sql と一致させる。
-- roles マスタは 0004_iam_seed.sql 投入済み前提。

INSERT INTO accounts (id, employee_id, status, token_version, created_at, updated_at) VALUES
  (1, 1, 'active', 0, 0, 0),
  (2, 2, 'active', 0, 0, 0),
  (3, 3, 'active', 0, 0, 0),
  (4, 4, 'active', 0, 0, 0),
  (5, 5, 'active', 0, 0, 0),
  (9, 9, 'active', 0, 0, 0),
  (10, 10, 'active', 0, 0, 0),
  (13, 13, 'active', 0, 0, 0),
  (16, 16, 'active', 0, 0, 0);

INSERT INTO identities (account_id, provider, subject, secret, email, email_verified, created_at) VALUES
  (1, 'password', 'you+e001@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e001@example.com', 1, 0),
  (2, 'password', 'you+e002@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e002@example.com', 1, 0),
  (3, 'password', 'you+e003@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e003@example.com', 1, 0),
  (4, 'password', 'you+e004@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e004@example.com', 1, 0),
  (5, 'password', 'you+e005@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e005@example.com', 1, 0),
  (9, 'password', 'you+e009@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e009@example.com', 1, 0),
  (10, 'password', 'you+e010@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e010@example.com', 1, 0),
  (13, 'password', 'you+e013@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e013@example.com', 1, 0),
  (16, 'password', 'you+e016@example.com', 'pbkdf2:100000:c2VlZC1zYWx0LW9wZW4ta2FydGUtZGV2LW9ubHk=:coaTuzsuvK/WAPk7FuQ1ckIbBbsJXq2QncSPrz6ksi8=', 'you+e016@example.com', 1, 0);

-- account_roles: E001 は admin、E002/E004 は manager、その他は member(seed-employees.ts と一致)。
-- Manager 役職が manager ロールを持たないと承認 inbox が誰も使えず、承認フローを試せない。
INSERT INTO account_roles (account_id, role_id, granted_by, granted_at)
  SELECT a.id, r.id, NULL, 0
  FROM accounts a
  JOIN roles r ON r.is_system = 1 AND r.key = (
    CASE
      WHEN a.id = 1 THEN 'admin'
      WHEN a.id IN (2, 4) THEN 'manager'
      ELSE 'member'
    END
  )
  WHERE a.id IN (1, 2, 3, 4, 5, 9, 10, 13, 16);
