-- インシデント記録（発生した障害・事故の事実記録）。
-- 原因分析や再発防止の判定は持たず、いつ・何が起き・解消したかの記録のみ。
CREATE TABLE IF NOT EXISTS it_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity TEXT,
  status TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

-- 発生日時の新しい順の走査に使う。
CREATE INDEX IF NOT EXISTS idx_it_incidents_occurred_at ON it_incidents (occurred_at);
