-- 採用の募集ポジション（社外個人情報を扱う候補者の親。募集の状態を open/closed で持つ）
CREATE TABLE IF NOT EXISTS recruitment_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  department_code TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recruitment_positions_status ON recruitment_positions (status);

-- 応募者（社外個人情報。選考ステージを applied→…→hired/rejected で進める。閲覧も権限保持者のみ）
CREATE TABLE IF NOT EXISTS recruitment_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  source TEXT,
  stage TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_position ON recruitment_candidates (position_id);
