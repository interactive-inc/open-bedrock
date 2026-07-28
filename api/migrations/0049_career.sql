-- 社内公募（部署・必要スキル・公開状態）
CREATE TABLE IF NOT EXISTS career_postings (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  dept_id INTEGER,
  dept_name TEXT,
  required_skills TEXT,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_career_postings_status ON career_postings (status);

-- 公募への応募（応募者・メッセージ・状態）
CREATE TABLE IF NOT EXISTS career_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  posting_id INTEGER NOT NULL,
  applicant_id INTEGER NOT NULL,
  message TEXT,
  status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_career_applications_posting ON career_applications (posting_id);

CREATE INDEX IF NOT EXISTS idx_career_applications_applicant ON career_applications (applicant_id);

-- 社員ごとのキャリアシート（目標・強み）
CREATE TABLE IF NOT EXISTS career_sheets (
  employee_id INTEGER PRIMARY KEY,
  goals_text TEXT,
  strengths_text TEXT,
  updated_at TEXT NOT NULL
);
