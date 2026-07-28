-- 給与明細の同一期間での二重発行を防ぐ。
-- payroll.sql の非ユニーク idx_payslips_employee_period を (employee_id, period) の一意制約へ置き換える。
DROP INDEX IF EXISTS idx_payslips_employee_period;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payslips_employee_period ON payslips (employee_id, period);
