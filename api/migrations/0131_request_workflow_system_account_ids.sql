-- Request workflow が保持する実行主体と候補を canonical System Account ID へ統一する。
-- legacy Account ID は 0127 が保証する digit-only の一対一投影だけを移行する。

CREATE TABLE request_workflow_account_migration_validation (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  missing_canonical_account_count INTEGER NOT NULL CHECK (missing_canonical_account_count = 0)
);--> statement-breakpoint

INSERT INTO request_workflow_account_migration_validation (
  singleton,
  missing_canonical_account_count
)
SELECT
  1,
  count(*)
FROM (
  SELECT updated_by_account_id AS legacy_account_id
  FROM application_workflows
  WHERE updated_by_account_id IS NOT NULL
  UNION ALL
  SELECT updated_by_account_id
  FROM application_workflow_revisions
  WHERE updated_by_account_id IS NOT NULL
  UNION ALL
  SELECT candidate_account_id
  FROM application_workflow_step_candidates
  UNION ALL
  SELECT approver_account_id
  FROM application_workflow_approvals
  WHERE approver_account_id IS NOT NULL
  UNION ALL
  SELECT actor_account_id
  FROM application_workflow_events
  WHERE actor_account_id IS NOT NULL
  UNION ALL
  SELECT created_by_account_id
  FROM approval_delegations
  WHERE created_by_account_id IS NOT NULL
) workflow_account
LEFT JOIN system_accounts canonical
  ON canonical.id = CAST(workflow_account.legacy_account_id AS TEXT)
WHERE canonical.id IS NULL;--> statement-breakpoint

DROP TABLE request_workflow_account_migration_validation;--> statement-breakpoint

CREATE TABLE request_workflow_sequence_backup (
  table_name TEXT PRIMARY KEY NOT NULL,
  sequence INTEGER NOT NULL
);--> statement-breakpoint

INSERT INTO request_workflow_sequence_backup (table_name, sequence)
SELECT name, seq
FROM sqlite_sequence
WHERE name IN ('application_workflow_approvals', 'application_workflow_events');--> statement-breakpoint

ALTER TABLE application_workflows RENAME TO application_workflows_legacy_account_ids;--> statement-breakpoint

CREATE TABLE application_workflows (
  template_id INTEGER PRIMARY KEY,
  definition_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_by_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT
    CHECK (
      updated_by_account_id IS NULL
      OR length(updated_by_account_id) BETWEEN 1 AND 255
    )
);--> statement-breakpoint

INSERT INTO application_workflows (
  template_id,
  definition_json,
  updated_at,
  revision,
  updated_by_account_id
)
SELECT
  template_id,
  definition_json,
  updated_at,
  revision,
  CASE
    WHEN updated_by_account_id IS NULL THEN NULL
    ELSE CAST(updated_by_account_id AS TEXT)
  END
FROM application_workflows_legacy_account_ids;--> statement-breakpoint

DROP TABLE application_workflows_legacy_account_ids;--> statement-breakpoint

ALTER TABLE application_workflow_revisions
  RENAME TO application_workflow_revisions_legacy_account_ids;--> statement-breakpoint

CREATE TABLE application_workflow_revisions (
  template_id INTEGER NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  definition_json TEXT NOT NULL,
  updated_by_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT
    CHECK (
      updated_by_account_id IS NULL
      OR length(updated_by_account_id) BETWEEN 1 AND 255
    ),
  created_at TEXT NOT NULL,
  PRIMARY KEY (template_id, revision)
);--> statement-breakpoint

INSERT INTO application_workflow_revisions (
  template_id,
  revision,
  definition_json,
  updated_by_account_id,
  created_at
)
SELECT
  template_id,
  revision,
  definition_json,
  CASE
    WHEN updated_by_account_id IS NULL THEN NULL
    ELSE CAST(updated_by_account_id AS TEXT)
  END,
  created_at
FROM application_workflow_revisions_legacy_account_ids;--> statement-breakpoint

DROP TABLE application_workflow_revisions_legacy_account_ids;--> statement-breakpoint

CREATE TRIGGER application_workflow_revisions_no_update
BEFORE UPDATE ON application_workflow_revisions
BEGIN
  SELECT RAISE(ABORT, 'application_workflow_revisions is append-only');
END;--> statement-breakpoint

CREATE TRIGGER application_workflow_revisions_no_delete
BEFORE DELETE ON application_workflow_revisions
BEGIN
  SELECT RAISE(ABORT, 'application_workflow_revisions is append-only');
END;--> statement-breakpoint

ALTER TABLE application_workflow_step_candidates
  RENAME TO application_workflow_step_candidates_legacy_account_ids;--> statement-breakpoint

CREATE TABLE application_workflow_step_candidates (
  application_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  candidate_employee_id INTEGER NOT NULL,
  candidate_account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT
    CHECK (length(candidate_account_id) BETWEEN 1 AND 255),
  source TEXT NOT NULL,
  selectors_json TEXT NOT NULL,
  resolution_id TEXT NOT NULL,
  eligible_from TEXT,
  resolved_at TEXT NOT NULL,
  PRIMARY KEY (application_id, step_key, round, candidate_account_id, source)
);--> statement-breakpoint

INSERT INTO application_workflow_step_candidates (
  application_id,
  step_key,
  round,
  candidate_employee_id,
  candidate_account_id,
  source,
  selectors_json,
  resolution_id,
  eligible_from,
  resolved_at
)
SELECT
  application_id,
  step_key,
  round,
  candidate_employee_id,
  CAST(candidate_account_id AS TEXT),
  source,
  selectors_json,
  resolution_id,
  eligible_from,
  resolved_at
FROM application_workflow_step_candidates_legacy_account_ids;--> statement-breakpoint

DROP TABLE application_workflow_step_candidates_legacy_account_ids;--> statement-breakpoint

CREATE INDEX idx_workflow_step_candidates_employee
  ON application_workflow_step_candidates
    (application_id, step_key, round, candidate_employee_id);--> statement-breakpoint

ALTER TABLE application_workflow_approvals
  RENAME TO application_workflow_approvals_legacy_account_ids;--> statement-breakpoint

CREATE TABLE application_workflow_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  approver_id INTEGER NOT NULL,
  approver_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT
    CHECK (
      approver_account_id IS NULL
      OR length(approver_account_id) BETWEEN 1 AND 255
    ),
  represented_approver_id INTEGER NOT NULL,
  delegation_id INTEGER,
  action TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);--> statement-breakpoint

INSERT INTO application_workflow_approvals (
  id,
  application_id,
  step_key,
  round,
  approver_id,
  approver_account_id,
  represented_approver_id,
  delegation_id,
  action,
  comment,
  created_at
)
SELECT
  id,
  application_id,
  step_key,
  round,
  approver_id,
  CASE
    WHEN approver_account_id IS NULL THEN NULL
    ELSE CAST(approver_account_id AS TEXT)
  END,
  represented_approver_id,
  delegation_id,
  action,
  comment,
  created_at
FROM application_workflow_approvals_legacy_account_ids;--> statement-breakpoint

DROP TABLE application_workflow_approvals_legacy_account_ids;--> statement-breakpoint

CREATE UNIQUE INDEX uq_workflow_approval_actor_step
  ON application_workflow_approvals (application_id, step_key, round, approver_id);--> statement-breakpoint

CREATE INDEX idx_workflow_approval_application
  ON application_workflow_approvals (application_id, step_key, round);--> statement-breakpoint

ALTER TABLE application_workflow_events
  RENAME TO application_workflow_events_legacy_account_ids;--> statement-breakpoint

CREATE TABLE application_workflow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  round INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT
    CHECK (
      actor_account_id IS NULL
      OR length(actor_account_id) BETWEEN 1 AND 255
    ),
  occurred_at TEXT NOT NULL,
  details_json TEXT NOT NULL
);--> statement-breakpoint

INSERT INTO application_workflow_events (
  id,
  application_id,
  step_key,
  round,
  event_type,
  actor_account_id,
  occurred_at,
  details_json
)
SELECT
  id,
  application_id,
  step_key,
  round,
  event_type,
  CASE
    WHEN actor_account_id IS NULL THEN NULL
    ELSE CAST(actor_account_id AS TEXT)
  END,
  occurred_at,
  details_json
FROM application_workflow_events_legacy_account_ids;--> statement-breakpoint

DROP TABLE application_workflow_events_legacy_account_ids;--> statement-breakpoint

CREATE UNIQUE INDEX uq_application_workflow_event_once
  ON application_workflow_events (application_id, step_key, round, event_type);--> statement-breakpoint

ALTER TABLE approval_delegations
  RENAME TO approval_delegations_legacy_account_ids;--> statement-breakpoint

CREATE TABLE approval_delegations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delegator_employee_id INTEGER NOT NULL,
  delegate_employee_id INTEGER NOT NULL,
  template_code TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_by_account_id TEXT
    REFERENCES system_accounts(id) ON DELETE RESTRICT
    CHECK (
      created_by_account_id IS NULL
      OR length(created_by_account_id) BETWEEN 1 AND 255
    ),
  cancelled_at TEXT,
  created_at TEXT NOT NULL
);--> statement-breakpoint

INSERT INTO approval_delegations (
  id,
  delegator_employee_id,
  delegate_employee_id,
  template_code,
  starts_at,
  ends_at,
  created_by_account_id,
  cancelled_at,
  created_at
)
SELECT
  id,
  delegator_employee_id,
  delegate_employee_id,
  template_code,
  starts_at,
  ends_at,
  CASE
    WHEN created_by_account_id IS NULL THEN NULL
    ELSE CAST(created_by_account_id AS TEXT)
  END,
  cancelled_at,
  created_at
FROM approval_delegations_legacy_account_ids;--> statement-breakpoint

DROP TABLE approval_delegations_legacy_account_ids;--> statement-breakpoint

CREATE INDEX idx_approval_delegations_delegate_period
  ON approval_delegations (delegate_employee_id, starts_at, ends_at);--> statement-breakpoint

UPDATE sqlite_sequence
SET seq = MAX(
  seq,
  COALESCE(
    (
      SELECT sequence
      FROM request_workflow_sequence_backup backup
      WHERE backup.table_name = sqlite_sequence.name
    ),
    seq
  )
)
WHERE name IN ('application_workflow_approvals', 'application_workflow_events');--> statement-breakpoint

INSERT INTO sqlite_sequence (name, seq)
SELECT backup.table_name, backup.sequence
FROM request_workflow_sequence_backup backup
WHERE NOT EXISTS (
  SELECT 1 FROM sqlite_sequence current WHERE current.name = backup.table_name
);--> statement-breakpoint

DROP TABLE request_workflow_sequence_backup;--> statement-breakpoint

CREATE TABLE request_workflow_account_final_validation (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  non_text_account_count INTEGER NOT NULL CHECK (non_text_account_count = 0),
  foreign_key_violation_count INTEGER NOT NULL CHECK (foreign_key_violation_count = 0)
);--> statement-breakpoint

INSERT INTO request_workflow_account_final_validation (
  singleton,
  non_text_account_count,
  foreign_key_violation_count
)
SELECT
  1,
  (
    SELECT count(*)
    FROM (
      SELECT updated_by_account_id AS account_id FROM application_workflows
      UNION ALL
      SELECT updated_by_account_id FROM application_workflow_revisions
      UNION ALL
      SELECT candidate_account_id FROM application_workflow_step_candidates
      UNION ALL
      SELECT approver_account_id FROM application_workflow_approvals
      UNION ALL
      SELECT actor_account_id FROM application_workflow_events
      UNION ALL
      SELECT created_by_account_id FROM approval_delegations
    ) stored_account
    WHERE account_id IS NOT NULL AND typeof(account_id) <> 'text'
  ),
  (
    SELECT count(*) FROM pragma_foreign_key_check
    WHERE "table" IN (
      'application_workflows',
      'application_workflow_revisions',
      'application_workflow_step_candidates',
      'application_workflow_approvals',
      'application_workflow_events',
      'approval_delegations'
    )
  );--> statement-breakpoint

DROP TABLE request_workflow_account_final_validation;--> statement-breakpoint
