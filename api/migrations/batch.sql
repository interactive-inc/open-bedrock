-- バッチジョブの実行状況（夜間同期・通知送信などの記録）
CREATE TABLE IF NOT EXISTS batch_jobs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs (status);
