-- payroll ドメインの seed
-- 対象テーブル: payslips, salary_revisions
-- migration: migrations/payroll.sql / 値: src/infrastructure/seed/seed-payslips.ts, seed-salary-revisions.ts

INSERT INTO payslips (id, employee_id, period, base_salary, allowances, deductions, net_pay, issued_at, status) VALUES
  (1, 5, '2026-04', 300000, 20000, 45000, 275000, '2026-04-25T00:00:00Z', 'issued'),
  (2, 1, '2026-04', 280000, 10000, 40000, 250000, '2026-04-25T00:00:00Z', 'issued'),
  (3, 5, '2026-03', 300000, 18000, 44000, 274000, '2026-03-25T00:00:00Z', 'issued');

INSERT INTO salary_revisions (id, employee_id, effective_date, previous_base_salary, new_base_salary, reason, created_at) VALUES
  (1, 5, '2025-04-01', 280000, 300000, 'annual_raise', '2025-03-20T00:00:00Z'),
  (2, 1, '2025-04-01', 260000, 280000, NULL, '2025-03-20T00:00:00Z');
