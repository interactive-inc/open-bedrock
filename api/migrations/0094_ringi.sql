-- 稟議（起案者・承認者・件名・金額・ステータス）。金額つきの汎用決裁。単段決裁。
CREATE TABLE IF NOT EXISTS ringi_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER NOT NULL,
  approver_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  decided_at TEXT,
  decision_comment TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ringi_requests_applicant ON ringi_requests (applicant_id);

CREATE INDEX IF NOT EXISTS idx_ringi_requests_approver ON ringi_requests (approver_id);

CREATE INDEX IF NOT EXISTS idx_ringi_requests_status ON ringi_requests (status);
