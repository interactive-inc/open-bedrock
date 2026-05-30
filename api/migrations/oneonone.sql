-- 1on1 の記録（参加者・実施日時・話題・所感・次アクション）
CREATE TABLE IF NOT EXISTS one_on_ones (
  id TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL,
  manager_id INTEGER NOT NULL,
  held_at TEXT NOT NULL,
  topics TEXT,
  manager_note TEXT,
  next_action TEXT
);

CREATE INDEX IF NOT EXISTS idx_one_on_ones_member ON one_on_ones (member_id);

CREATE INDEX IF NOT EXISTS idx_one_on_ones_manager ON one_on_ones (manager_id);
