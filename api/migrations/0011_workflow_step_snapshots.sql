-- ワークフローの候補者と定足数をステップ開始時点で固定する。
CREATE TABLE IF NOT EXISTS application_workflow_step_snapshots (
  application_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  required_approvals INTEGER NOT NULL,
  activated_at TEXT NOT NULL,
  due_at TEXT,
  escalated_at TEXT,
  resolution_reason TEXT NOT NULL,
  resolution_id TEXT NOT NULL,
  PRIMARY KEY (application_id, step_key, round)
);

CREATE TABLE IF NOT EXISTS application_workflow_step_candidates (
  application_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  candidate_employee_id INTEGER NOT NULL,
  candidate_account_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  selectors_json TEXT NOT NULL,
  resolution_id TEXT NOT NULL,
  eligible_from TEXT,
  resolved_at TEXT NOT NULL,
  PRIMARY KEY (application_id, step_key, round, candidate_account_id, source)
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_candidates_employee
  ON application_workflow_step_candidates
    (application_id, step_key, round, candidate_employee_id);

-- 決定を行ったログイン主体と、代理承認に使われた委任根拠を履歴へ残す。
-- 0010 以前の履歴は値を復元できないため nullable とする。
ALTER TABLE application_workflow_approvals ADD COLUMN approver_account_id INTEGER;
ALTER TABLE application_workflow_approvals ADD COLUMN delegation_id INTEGER;
ALTER TABLE approval_delegations ADD COLUMN created_by_account_id INTEGER;
ALTER TABLE approval_delegations ADD COLUMN cancelled_at TEXT;

CREATE TABLE IF NOT EXISTS application_workflow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_account_id INTEGER,
  occurred_at TEXT NOT NULL,
  details_json TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_application_workflow_event_once
  ON application_workflow_events (application_id, step_key, round, event_type);
