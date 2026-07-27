-- ライフイベント届出（結婚・出産・転居・忌引・扶養変更などの届出を記録）
CREATE TABLE IF NOT EXISTS life_events (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_life_events_employee ON life_events (employee_id);
