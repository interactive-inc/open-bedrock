-- 社内アナウンス（全社お知らせ。下書き→公開→アーカイブの状態を持つ）
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  published_on TEXT,
  author_employee_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements (status);
