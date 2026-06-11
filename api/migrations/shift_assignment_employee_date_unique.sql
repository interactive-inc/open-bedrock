-- 同一社員・同一日のシフト割当の重複を DB レベルで防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_assignment_employee_date
  ON shift_assignments (employee_id, date);
