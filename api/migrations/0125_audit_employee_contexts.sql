-- System の監査エンベロープから Company Employee 文脈を分離する。
-- 公開 API の互換投影と既存の2文 append fragment は Company 側の view/staging table で保つ。

CREATE TABLE audit_event_employee_contexts (
  audit_event_id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL
);

INSERT INTO audit_event_employee_contexts (audit_event_id, employee_id)
SELECT id, actor_employee_id
FROM audit_events
WHERE actor_employee_id IS NOT NULL;

CREATE INDEX idx_audit_event_employee_contexts_employee
  ON audit_event_employee_contexts (employee_id, audit_event_id);

CREATE TABLE audit_events_without_company_context (
  id INTEGER PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  actor_account_id INTEGER,
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
  created_at INTEGER NOT NULL
);

INSERT INTO audit_events_without_company_context (
  id,
  event_id,
  request_id,
  actor_account_id,
  action,
  target_type,
  target_id,
  outcome,
  reason_code,
  authorization_json,
  before_json,
  after_json,
  metadata_json,
  client_ip,
  client_name,
  created_at
)
SELECT
  id,
  event_id,
  request_id,
  actor_account_id,
  action,
  target_type,
  target_id,
  outcome,
  reason_code,
  authorization_json,
  before_json,
  after_json,
  metadata_json,
  client_ip,
  client_name,
  created_at
FROM audit_events;

DROP TRIGGER IF EXISTS audit_logs_prevent_update;
DROP TRIGGER IF EXISTS audit_logs_prevent_delete;
DROP TRIGGER IF EXISTS audit_logs_register_insert;
DROP TRIGGER IF EXISTS audit_events_append_guard_prevent_insert;
DROP TRIGGER IF EXISTS audit_logs_append_guard_prevent_update;
DROP TRIGGER IF EXISTS audit_logs_append_guard_prevent_delete;

DROP TABLE audit_events;
ALTER TABLE audit_events_without_company_context RENAME TO audit_events;

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
    SELECT 1
    FROM audit_logs_append_guard
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
    SELECT 1
    FROM audit_events
    WHERE id = NEW.audit_id AND event_id = NEW.event_id
  )
  OR EXISTS (
    SELECT 1
    FROM audit_logs_append_guard
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

CREATE TRIGGER audit_event_employee_contexts_prevent_update
BEFORE UPDATE ON audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'audit employee context is append-only');
END;

CREATE TRIGGER audit_event_employee_contexts_prevent_delete
BEFORE DELETE ON audit_event_employee_contexts
BEGIN
  SELECT RAISE(ABORT, 'audit employee context is append-only');
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
  actor_account_id INTEGER,
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
  created_at INTEGER NOT NULL
);

CREATE TRIGGER company_audit_event_appends_dispatch
AFTER INSERT ON company_audit_event_appends
BEGIN
  INSERT INTO audit_events (
    event_id,
    request_id,
    actor_account_id,
    action,
    target_type,
    target_id,
    outcome,
    reason_code,
    authorization_json,
    before_json,
    after_json,
    metadata_json,
    client_ip,
    client_name,
    created_at
  ) VALUES (
    NEW.event_id,
    NEW.request_id,
    NEW.actor_account_id,
    NEW.action,
    NEW.target_type,
    NEW.target_id,
    NEW.outcome,
    NEW.reason_code,
    NEW.authorization_json,
    NEW.before_json,
    NEW.after_json,
    NEW.metadata_json,
    NEW.client_ip,
    NEW.client_name,
    NEW.created_at
  );

  INSERT INTO audit_event_employee_contexts (audit_event_id, employee_id)
  SELECT event.id, NEW.actor_employee_id
  FROM audit_events event
  WHERE event.event_id = NEW.event_id
    AND NEW.actor_employee_id IS NOT NULL;

  DELETE FROM company_audit_event_appends WHERE staging_id = NEW.staging_id;
END;
