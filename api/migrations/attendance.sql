-- 勤怠記録（出勤・退勤の打刻と労働・残業時間）
CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  clock_in_at TEXT,
  clock_out_at TEXT,
  work_minutes INTEGER,
  overtime_minutes INTEGER,
  note TEXT,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_employee ON attendance_records (employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_work_date ON attendance_records (work_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_open ON attendance_records (employee_id, status);
