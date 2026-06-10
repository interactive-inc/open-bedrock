-- シフトパターン（勤務区分の雛形：勤務時間と休憩）
CREATE TABLE IF NOT EXISTS shift_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_patterns_code ON shift_patterns (code);

-- シフト割当（社員ごとの日次シフト。published_at:null は下書き）
CREATE TABLE IF NOT EXISTS shift_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  pattern_id INTEGER,
  date TEXT NOT NULL,
  note TEXT,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee ON shift_assignments (employee_id);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_date ON shift_assignments (date);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_pattern ON shift_assignments (pattern_id);

-- シフト交代申請（申請者と交代相手・対象日・承認状態）
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_employee_id INTEGER NOT NULL,
  target_employee_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  approved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_requester ON shift_swap_requests (requester_employee_id);
