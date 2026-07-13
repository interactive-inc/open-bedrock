-- 申請テンプレートごとの本格ワークフロー定義。既存 approver_roles は互換用に残す。
CREATE TABLE IF NOT EXISTS application_workflows (
  template_id INTEGER PRIMARY KEY,
  definition_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 申請時点の定義を固定し、テンプレート変更で進行中申請が変質しないようにする。
CREATE TABLE IF NOT EXISTS application_workflow_instances (
  application_id INTEGER PRIMARY KEY,
  definition_json TEXT NOT NULL,
  current_step_key TEXT NOT NULL,
  current_round INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL,
  due_at TEXT
);

CREATE TABLE IF NOT EXISTS application_workflow_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  approver_id INTEGER NOT NULL,
  represented_approver_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_approval_actor_step
  ON application_workflow_approvals (application_id, step_key, round, approver_id);

CREATE INDEX IF NOT EXISTS idx_workflow_approval_application
  ON application_workflow_approvals (application_id, step_key, round);

-- 承認権限の期間付き代理。scope は全申請または特定テンプレートコード。
CREATE TABLE IF NOT EXISTS approval_delegations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delegator_employee_id INTEGER NOT NULL,
  delegate_employee_id INTEGER NOT NULL,
  template_code TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegate_period
  ON approval_delegations (delegate_employee_id, starts_at, ends_at);

-- 評価サイクルを開始したときに組織図から評価者を生成する方針。
CREATE TABLE IF NOT EXISTS review_cycle_policies (
  cycle_id INTEGER PRIMARY KEY,
  policy_json TEXT NOT NULL
);
