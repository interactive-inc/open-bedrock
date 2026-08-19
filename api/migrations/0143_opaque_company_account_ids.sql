-- Company が参照する System Account ID を、数値ではなく canonical opaque TEXT として確定する。

-- Employee and organization lifecycle ----------------------------------------

ALTER TABLE employees
  ADD COLUMN archived_by_account_id_opaque TEXT
  CHECK (
    archived_by_account_id_opaque IS NULL
    OR length(archived_by_account_id_opaque) BETWEEN 1 AND 255
  );
UPDATE employees
SET archived_by_account_id_opaque = CAST(archived_by_account_id AS TEXT)
WHERE archived_by_account_id IS NOT NULL;
ALTER TABLE employees DROP COLUMN archived_by_account_id;
ALTER TABLE employees RENAME COLUMN archived_by_account_id_opaque TO archived_by_account_id;

ALTER TABLE org_departments
  ADD COLUMN archived_by_account_id_opaque TEXT
  CHECK (
    archived_by_account_id_opaque IS NULL
    OR length(archived_by_account_id_opaque) BETWEEN 1 AND 255
  );
UPDATE org_departments
SET archived_by_account_id_opaque = CAST(archived_by_account_id AS TEXT)
WHERE archived_by_account_id IS NOT NULL;
ALTER TABLE org_departments DROP COLUMN archived_by_account_id;
ALTER TABLE org_departments RENAME COLUMN archived_by_account_id_opaque TO archived_by_account_id;

ALTER TABLE lifecycle_effect_template_bindings
  ADD COLUMN updated_by_account_id_opaque TEXT
  CHECK (
    updated_by_account_id_opaque IS NULL
    OR length(updated_by_account_id_opaque) BETWEEN 1 AND 255
  );
UPDATE lifecycle_effect_template_bindings
SET updated_by_account_id_opaque = CAST(updated_by_account_id AS TEXT)
WHERE updated_by_account_id IS NOT NULL;
ALTER TABLE lifecycle_effect_template_bindings DROP COLUMN updated_by_account_id;
ALTER TABLE lifecycle_effect_template_bindings
  RENAME COLUMN updated_by_account_id_opaque TO updated_by_account_id;

-- Company audit projection ----------------------------------------------------

DROP VIEW company_audit_events;
DROP TRIGGER company_audit_event_appends_dispatch;
DROP TABLE company_audit_event_appends;

DROP TRIGGER audit_events_register_insert;
DROP TRIGGER audit_events_prevent_update;
DROP TRIGGER audit_events_prevent_delete;
DROP TRIGGER audit_events_append_guard_prevent_insert;
DROP TRIGGER audit_events_append_guard_prevent_update;
DROP TRIGGER audit_events_append_guard_prevent_delete;
DROP TRIGGER audit_event_employee_contexts_validate_insert;

CREATE TABLE audit_events_with_opaque_account_id (
  id INTEGER PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL CHECK (client_name IN ('web', 'cli', 'api', 'system')),
  created_at INTEGER NOT NULL,
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255)
);

INSERT INTO audit_events_with_opaque_account_id (
  id, event_id, request_id, actor_account_id, action, target_type, target_id,
  outcome, reason_code, authorization_json, before_json, after_json, metadata_json,
  client_ip, client_name, created_at
)
SELECT
  id, event_id, request_id,
  CASE WHEN actor_account_id IS NULL THEN NULL ELSE CAST(actor_account_id AS TEXT) END,
  action, target_type, target_id, outcome, reason_code, authorization_json, before_json,
  after_json, metadata_json, client_ip, client_name, created_at
FROM audit_events;

DROP TABLE audit_events;
ALTER TABLE audit_events_with_opaque_account_id RENAME TO audit_events;

CREATE INDEX idx_audit_logs_request ON audit_events (request_id);
CREATE INDEX idx_audit_logs_actor ON audit_events (actor_account_id, created_at, id);
CREATE INDEX idx_audit_logs_action ON audit_events (action, created_at, id);
CREATE INDEX idx_audit_logs_target ON audit_events (target_type, target_id, created_at, id);
CREATE INDEX idx_audit_logs_outcome ON audit_events (outcome, created_at, id);
CREATE INDEX idx_audit_logs_created ON audit_events (created_at, id);

CREATE TRIGGER audit_events_register_insert
AFTER INSERT ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only')
  WHERE EXISTS (
    SELECT 1 FROM audit_logs_append_guard
    WHERE audit_id = NEW.id OR event_id = NEW.event_id
  );

  INSERT INTO audit_logs_append_guard (audit_id, event_id)
  VALUES (NEW.id, NEW.event_id);
END;

CREATE TRIGGER audit_events_prevent_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER audit_events_prevent_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER audit_events_append_guard_prevent_insert
BEFORE INSERT ON audit_logs_append_guard
WHEN
  NOT EXISTS (
    SELECT 1 FROM audit_events
    WHERE id = NEW.audit_id AND event_id = NEW.event_id
  )
  OR EXISTS (
    SELECT 1 FROM audit_logs_append_guard
    WHERE audit_id = NEW.audit_id OR event_id = NEW.event_id
  )
BEGIN
  SELECT RAISE(ABORT, 'audit_events append guard is immutable');
END;

CREATE TRIGGER audit_events_append_guard_prevent_update
BEFORE UPDATE ON audit_logs_append_guard
BEGIN
  SELECT RAISE(ABORT, 'audit_events append guard is immutable');
END;

CREATE TRIGGER audit_events_append_guard_prevent_delete
BEFORE DELETE ON audit_logs_append_guard
BEGIN
  SELECT RAISE(ABORT, 'audit_events append guard is immutable');
END;

CREATE TRIGGER audit_event_employee_contexts_validate_insert
BEFORE INSERT ON audit_event_employee_contexts
WHEN NOT EXISTS (
  SELECT 1 FROM audit_events WHERE id = NEW.audit_event_id
)
BEGIN
  SELECT RAISE(ABORT, 'audit employee context requires an audit event');
END;

CREATE VIEW company_audit_events AS
SELECT
  event.id,
  event.event_id,
  event.request_id,
  event.actor_account_id,
  employee_context.employee_id AS actor_employee_id,
  event.action,
  event.target_type,
  event.target_id,
  event.outcome,
  event.reason_code,
  event.authorization_json,
  event.before_json,
  event.after_json,
  event.metadata_json,
  event.client_ip,
  event.client_name,
  event.created_at
FROM audit_events event
LEFT JOIN audit_event_employee_contexts employee_context
  ON employee_context.audit_event_id = event.id;

CREATE TABLE company_audit_event_appends (
  staging_id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  actor_account_id TEXT,
  actor_employee_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL,
  reason_code TEXT,
  authorization_json TEXT,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT,
  client_ip TEXT,
  client_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (actor_account_id IS NULL OR length(actor_account_id) BETWEEN 1 AND 255)
);

CREATE TRIGGER company_audit_event_appends_dispatch
AFTER INSERT ON company_audit_event_appends
BEGIN
  INSERT INTO audit_events (
    event_id, request_id, actor_account_id, action, target_type, target_id, outcome,
    reason_code, authorization_json, before_json, after_json, metadata_json,
    client_ip, client_name, created_at
  ) VALUES (
    NEW.event_id, NEW.request_id, NEW.actor_account_id, NEW.action, NEW.target_type,
    NEW.target_id, NEW.outcome, NEW.reason_code, NEW.authorization_json, NEW.before_json,
    NEW.after_json, NEW.metadata_json, NEW.client_ip, NEW.client_name, NEW.created_at
  );

  INSERT INTO audit_event_employee_contexts (audit_event_id, employee_id)
  SELECT event.id, NEW.actor_employee_id
  FROM audit_events event
  WHERE event.event_id = NEW.event_id
    AND NEW.actor_employee_id IS NOT NULL;

  DELETE FROM company_audit_event_appends WHERE staging_id = NEW.staging_id;
END;

-- Employee lifecycle ----------------------------------------------------------

DROP TRIGGER personnel_actions_no_update;
DROP TRIGGER personnel_actions_no_delete;

ALTER TABLE personnel_actions RENAME TO personnel_actions_with_numeric_account_id;

CREATE TABLE personnel_actions (
  id TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'hire', 'rehire', 'primary_assignment_started', 'transferred',
    'concurrent_assignment_started', 'assignment_ended', 'position_changed',
    'manager_changed', 'department_responsibility_started',
    'department_responsibility_ended', 'leave_started', 'returned', 'retired',
    'corrected', 'legacy_baseline'
  )),
  event_on TEXT NOT NULL CHECK (
    length(event_on) = 10 AND substr(event_on, 5, 1) = '-' AND substr(event_on, 8, 1) = '-'
  ),
  recorded_at INTEGER NOT NULL,
  recorded_by_account_id TEXT,
  requested_by_employee_id INTEGER,
  source_type TEXT NOT NULL CHECK (source_type IN ('application', 'direct', 'migration', 'system')),
  source_application_id INTEGER,
  corrects_action_id TEXT,
  operation_id TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 200),
  payload_fingerprint TEXT NOT NULL CHECK (length(payload_fingerprint) = 64),
  summary_json TEXT NOT NULL CHECK (json_valid(summary_json)),
  CHECK (
    (source_type = 'application' AND source_application_id IS NOT NULL)
    OR (source_type != 'application' AND source_application_id IS NULL)
  ),
  CHECK (corrects_action_id IS NULL OR corrects_action_id != id),
  CHECK (recorded_by_account_id IS NULL OR length(recorded_by_account_id) BETWEEN 1 AND 255)
);

INSERT INTO personnel_actions (
  id, employee_id, kind, event_on, recorded_at, recorded_by_account_id,
  requested_by_employee_id, source_type, source_application_id, corrects_action_id,
  operation_id, payload_fingerprint, summary_json
)
SELECT
  id, employee_id, kind, event_on, recorded_at,
  CASE WHEN recorded_by_account_id IS NULL THEN NULL ELSE CAST(recorded_by_account_id AS TEXT) END,
  requested_by_employee_id, source_type, source_application_id, corrects_action_id,
  operation_id, payload_fingerprint, summary_json
FROM personnel_actions_with_numeric_account_id;

DROP TABLE personnel_actions_with_numeric_account_id;

CREATE INDEX idx_personnel_actions_employee_timeline
  ON personnel_actions (employee_id, event_on DESC, recorded_at DESC, id DESC);
CREATE UNIQUE INDEX uq_personnel_actions_source_application
  ON personnel_actions (source_application_id)
  WHERE source_application_id IS NOT NULL;
CREATE UNIQUE INDEX uq_personnel_actions_correction
  ON personnel_actions (corrects_action_id)
  WHERE corrects_action_id IS NOT NULL;

CREATE TRIGGER personnel_actions_no_update
BEFORE UPDATE ON personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'personnel_actions is append-only');
END;

CREATE TRIGGER personnel_actions_no_delete
BEFORE DELETE ON personnel_actions
BEGIN
  SELECT RAISE(ABORT, 'personnel_actions is append-only');
END;

-- Governance -----------------------------------------------------------------

ALTER TABLE governance_org_role_assignments
  RENAME TO governance_org_role_assignments_with_numeric_account_ids;

CREATE TABLE governance_org_role_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_role_code TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  department_code TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  source_document_code TEXT,
  created_by_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_by_account_id TEXT,
  revoked_at TEXT,
  CHECK (ends_on IS NULL OR starts_on < ends_on),
  CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  CHECK (revoked_by_account_id IS NULL OR length(revoked_by_account_id) BETWEEN 1 AND 255)
);

INSERT INTO governance_org_role_assignments (
  id, org_role_code, employee_id, department_code, starts_on, ends_on,
  source_document_code, created_by_account_id, created_at, revoked_by_account_id, revoked_at
)
SELECT
  id, org_role_code, employee_id, department_code, starts_on, ends_on,
  source_document_code, CAST(created_by_account_id AS TEXT), created_at,
  CASE WHEN revoked_by_account_id IS NULL THEN NULL ELSE CAST(revoked_by_account_id AS TEXT) END,
  revoked_at
FROM governance_org_role_assignments_with_numeric_account_ids;

DROP TABLE governance_org_role_assignments_with_numeric_account_ids;
CREATE INDEX idx_governance_role_assignments_role_period
  ON governance_org_role_assignments (org_role_code, starts_on, ends_on);
CREATE INDEX idx_governance_role_assignments_employee
  ON governance_org_role_assignments (employee_id);

ALTER TABLE governance_documents RENAME TO governance_documents_with_numeric_account_id;

CREATE TABLE governance_documents (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('policy', 'procedure', 'guideline', 'control')),
  classification TEXT NOT NULL
    CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
  owner_capability_code TEXT NOT NULL,
  steward_org_role_code TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  current_version_id TEXT,
  source_path TEXT NOT NULL UNIQUE,
  created_by_account_id TEXT NOT NULL CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO governance_documents (
  id, code, title, kind, classification, owner_capability_code, steward_org_role_code,
  status, current_version_id, source_path, created_by_account_id, created_at, updated_at
)
SELECT
  id, code, title, kind, classification, owner_capability_code, steward_org_role_code,
  status, current_version_id, source_path, CAST(created_by_account_id AS TEXT), created_at, updated_at
FROM governance_documents_with_numeric_account_id;

DROP TABLE governance_documents_with_numeric_account_id;

ALTER TABLE governance_document_versions
  RENAME TO governance_document_versions_with_numeric_account_ids;

CREATE TABLE governance_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version TEXT NOT NULL,
  body_md TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  procedure_json TEXT,
  content_hash TEXT NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  review_due_on TEXT,
  state TEXT NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft', 'in_review', 'published', 'superseded', 'rejected')),
  created_by_account_id TEXT NOT NULL CHECK (length(created_by_account_id) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  published_by_account_id TEXT,
  published_at TEXT,
  UNIQUE (document_id, version),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_from < effective_to),
  CHECK (published_by_account_id IS NULL OR length(published_by_account_id) BETWEEN 1 AND 255)
);

INSERT INTO governance_document_versions (
  id, document_id, version, body_md, metadata_json, procedure_json, content_hash,
  effective_from, effective_to, review_due_on, state, created_by_account_id,
  created_at, published_by_account_id, published_at
)
SELECT
  id, document_id, version, body_md, metadata_json, procedure_json, content_hash,
  effective_from, effective_to, review_due_on, state, CAST(created_by_account_id AS TEXT),
  created_at,
  CASE WHEN published_by_account_id IS NULL THEN NULL ELSE CAST(published_by_account_id AS TEXT) END,
  published_at
FROM governance_document_versions_with_numeric_account_ids;

DROP TABLE governance_document_versions_with_numeric_account_ids;
CREATE INDEX idx_governance_versions_document_state
  ON governance_document_versions (document_id, state);
