-- 通知（社員宛ての申請・承認・リマインド・お知らせ）
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_employee_id INTEGER NOT NULL,
  source_domain TEXT NOT NULL,
  source_id INTEGER,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_employee_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications (recipient_employee_id) WHERE is_read = 0;
