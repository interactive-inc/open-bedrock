-- 申請テンプレート（種類・カテゴリ・入力スキーマ・承認ロール）
CREATE TABLE IF NOT EXISTS application_templates (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  schema_json TEXT NOT NULL,
  approver_roles TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_application_templates_category ON application_templates (category);

-- 申請（テンプレートに紐づく申請者の提出）
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  applicant_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  current_step TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications (applicant_id);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);

-- 申請への承認/却下アクションの記録
CREATE TABLE IF NOT EXISTS application_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  approver_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_application_approvals_application ON application_approvals (application_id);
