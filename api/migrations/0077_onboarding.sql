-- 入社/退職手続きのテンプレート（チェックリストの雛形）
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_onboarding_templates_kind ON onboarding_templates (kind);

-- テンプレートに含まれるタスク定義（並び順・担当ロール）
CREATE TABLE IF NOT EXISTS onboarding_template_tasks (
  template_code TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  owner_role TEXT,
  PRIMARY KEY (template_code, code)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_template_tasks_template ON onboarding_template_tasks (template_code);

-- 社員へのテンプレート割り当て（手続きの進行状態）
CREATE TABLE IF NOT EXISTS onboarding_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  template_code TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_onboarding_assignments_employee ON onboarding_assignments (employee_id);

-- 割り当てから展開された個別タスク（完了状態）
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  template_task_code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_assignment ON onboarding_tasks (assignment_id);
