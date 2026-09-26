-- Company Employee と Employment を同じ canonical identity で初期化する。

INSERT INTO company_employees
  (id, official_name, employee_code, email, phone, created_at, updated_at)
VALUES
  ('01900062-0000-7000-8000-000000000001', 'Alex Carter', 'E001', 'you+e001@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000002', 'Blake Morgan', 'E002', 'you+e002@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000003', 'Casey Reed', 'E003', 'you+e003@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000004', 'Drew Sato', 'E004', 'you+e004@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000005', 'Emery Lane', 'E005', 'you+e005@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000006', 'Sage Hayashi', 'E006', 'you+e006@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000009', 'Finley Brooks', 'E009', 'you+e009@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-00000000000a', 'Gray Ellis', 'E010', 'you+e010@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-00000000000d', 'Harper Quinn', 'E013', 'you+e013@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-00000000000f', 'Riley Tanaka', 'E015', 'you+e015@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000010', 'Indi Vaughn', 'E016', 'you+e016@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000011', 'Jordan Pike', 'E017', 'you+e017@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000012', 'Kris Nolan', 'E018', 'you+e018@example.com', NULL, 1767225600000, 1767225600000),
  ('01900062-0000-7000-8000-000000000063', 'Robin Uchida', 'E099', 'you+e099@example.com', NULL, 1767225600000, 1767225600000);

INSERT INTO company_employments
  (id, employee_id, contract_name, employment_type, hire_date, status,
   termination_date, created_at, updated_at)
SELECT
  '01900064' || substr(id, 9),
  id,
  official_name,
  'FULL_TIME',
  CASE employee_code WHEN 'E018' THEN '2025-01-01' ELSE '2026-01-01' END,
  CASE employee_code
    WHEN 'E017' THEN 'ON_LEAVE'
    WHEN 'E018' THEN 'TERMINATED'
    ELSE 'ACTIVE'
  END,
  CASE employee_code WHEN 'E018' THEN '2025-12-31' ELSE NULL END,
  1767225600000,
  1767225600000
FROM company_employees;
