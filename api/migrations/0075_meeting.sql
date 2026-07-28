-- 会議体マスタ（定例会議などの器。cadence は週次/月次などの開催頻度メモ）
CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cadence TEXT,
  description TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings (status);

-- 議事録（会議体ごとの開催記録。閲覧は全認証者、記録は誰でも書ける）
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id INTEGER PRIMARY KEY,
  meeting_id INTEGER NOT NULL,
  held_on TEXT NOT NULL,
  title TEXT NOT NULL,
  attendees TEXT,
  body_md TEXT NOT NULL,
  author_employee_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting ON meeting_minutes (meeting_id);
