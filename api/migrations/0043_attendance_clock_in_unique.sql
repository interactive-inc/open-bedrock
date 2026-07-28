-- 同一従業員が open 状態の勤怠レコードを複数持てないことを DB レベルで保証する。
-- SQLite の部分インデックスを利用し、status = 'open' の行に限って employee_id を一意にする。
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_employee_open_unique
  ON attendance_records (employee_id) WHERE status = 'open';
