-- 文書台帳（契約書・許認可などのメタデータ台帳。本体ファイルは持たず所在のみ記録する）
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,
  location TEXT NOT NULL,
  partner_code TEXT,
  expires_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_expires_on ON documents (expires_on);
