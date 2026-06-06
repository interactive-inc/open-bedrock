-- 感謝（サンクス）。送り手が受け手へ送る感謝メッセージ。points は将来のポイント付与用で本 Task では常に 0。
CREATE TABLE IF NOT EXISTS thanks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_employee_id INTEGER NOT NULL,
  recipient_employee_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thanks_recipient ON thanks (recipient_employee_id);

CREATE INDEX IF NOT EXISTS idx_thanks_created_at ON thanks (created_at);
