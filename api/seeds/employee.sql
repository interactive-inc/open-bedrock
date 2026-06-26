-- employee ドメインの seed(純台帳)
-- migration 0001_employee.sql + 0006_iam_drop_employee_auth_columns.sql 適用後の employees へ INSERT する。
-- 認証(email/password)・認可(role)は IAM が正で、seeds/iam.sql が accounts/identities/account_roles へ投入する。
-- 値は src/infrastructure/seed/seed-employees.ts と一致させる(テスト期待値と整合)。

INSERT INTO employees (id, code, name, dept_id, dept_name, position, status) VALUES
  (1, 'E001', 'Alex Carter', 1, 'Corporate Planning', 'CTO', 'active'),
  (2, 'E002', 'Blake Morgan', 2, 'Human Resources', 'HR Manager', 'active'),
  (3, 'E003', 'Casey Reed', 2, 'Human Resources', 'HR Staff', 'active'),
  (4, 'E004', 'Drew Sato', 3, 'Engineering', 'Engineering Manager', 'active'),
  (5, 'E005', 'Emery Lane', 3, 'Engineering', 'Senior Engineer', 'active'),
  (9, 'E009', 'Finley Brooks', 4, 'Sales', 'Sales Manager', 'active'),
  (10, 'E010', 'Gray Ellis', 4, 'Sales', 'Sales Staff', 'active'),
  (13, 'E013', 'Harper Quinn', 5, 'Customer Success', 'CS Manager', 'active'),
  (16, 'E016', 'Indi Vaughn', 6, 'Administration', 'Admin Manager', 'active');
