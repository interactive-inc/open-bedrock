-- employee ドメインの seed
-- migration 0001_employee.sql の employees テーブルへ INSERT する。
-- 値は src/infrastructure/seed/seed-employees.ts と一致させる（テスト期待値と整合）。

INSERT INTO employees (id, code, name, email, password_hash, role, dept_id, dept_name, position, status) VALUES
  (1, 'E001', 'Alex Carter', 'you+e001@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'admin', 1, 'Corporate Planning', 'CTO', 'active'),
  (2, 'E002', 'Blake Morgan', 'you+e002@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'member', 2, 'Human Resources', 'HR Manager', 'active'),
  (3, 'E003', 'Casey Reed', 'you+e003@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'member', 2, 'Human Resources', 'HR Staff', 'active'),
  (4, 'E004', 'Drew Sato', 'you+e004@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'member', 3, 'Engineering', 'Engineering Manager', 'active'),
  (5, 'E005', 'Emery Lane', 'you+e005@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'member', 3, 'Engineering', 'Senior Engineer', 'active'),
  (9, 'E009', 'Finley Brooks', 'you+e009@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'member', 4, 'Sales', 'Sales Manager', 'active'),
  (10, 'E010', 'Gray Ellis', 'you+e010@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'member', 4, 'Sales', 'Sales Staff', 'active'),
  (13, 'E013', 'Harper Quinn', 'you+e013@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'member', 5, 'Customer Success', 'CS Manager', 'active'),
  (16, 'E016', 'Indi Vaughn', 'you+e016@example.com', '44e344c78f1e77e914869063226486fc93854d35c34911ab34936b26c077d247', 'member', 6, 'Administration', 'Admin Manager', 'active');
