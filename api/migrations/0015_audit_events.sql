-- 旧 IAM 監査ログを、要求相関と変更差分を保持する append-only 監査イベントへ移行する。
-- 既存行の target_type は NULL を許容しているため、移行後も nullable のまま保持する。

CREATE TABLE audit_logs_next (
  id INTEGER PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  request_id TEXT NOT NULL,
  actor_account_id INTEGER,
  actor_employee_id INTEGER,
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

INSERT INTO audit_logs_next (
  id,
  event_id,
  request_id,
  actor_account_id,
  actor_employee_id,
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
  'legacy-' || CAST(id AS TEXT),
  'legacy-' || CAST(id AS TEXT),
  actor_account_id,
  NULL,
  action,
  target_type,
  CAST(target_id AS TEXT),
  'succeeded',
  NULL,
  NULL,
  NULL,
  NULL,
  CASE
    WHEN metadata IS NULL THEN NULL
    WHEN json_valid(metadata) THEN metadata
    ELSE json_object('legacy_text', metadata)
  END,
  ip,
  'api',
  created_at
FROM audit_logs;

DROP TABLE audit_logs;
ALTER TABLE audit_logs_next RENAME TO audit_logs;

CREATE INDEX idx_audit_logs_request ON audit_logs (request_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_account_id, created_at, id);
CREATE INDEX idx_audit_logs_actor_employee ON audit_logs (actor_employee_id, created_at, id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action, created_at, id);
CREATE INDEX idx_audit_logs_target ON audit_logs (target_type, target_id, created_at, id);
CREATE INDEX idx_audit_logs_outcome ON audit_logs (outcome, created_at, id);
CREATE INDEX idx_audit_logs_created ON audit_logs (created_at, id);

-- INSERT OR REPLACE は DELETE trigger を迂回できるため、過去に使ったキーを独立して保持する。
-- INTEGER PRIMARY KEY の BEFORE INSERT では auto-ID の NEW.id が未確定値 -1 になり得るので、
-- 実 ID が確定した AFTER INSERT で guard と照合する。
CREATE TABLE audit_logs_append_guard (
  audit_id INTEGER NOT NULL UNIQUE,
  event_id TEXT NOT NULL PRIMARY KEY
) WITHOUT ROWID;

INSERT INTO audit_logs_append_guard (audit_id, event_id)
SELECT id, event_id FROM audit_logs;

CREATE TRIGGER audit_logs_register_insert
AFTER INSERT ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only')
  WHERE EXISTS (
    SELECT 1
    FROM audit_logs_append_guard
    WHERE audit_id = NEW.id OR event_id = NEW.event_id
  );

  INSERT INTO audit_logs_append_guard (audit_id, event_id)
  VALUES (NEW.id, NEW.event_id);
END;

CREATE TRIGGER audit_logs_prevent_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only');
END;

CREATE TRIGGER audit_logs_prevent_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit_logs is append-only');
END;

-- guard 自身は audit_logs の AFTER INSERT から一致する新規キーを登録する場合だけ追記できる。
CREATE TRIGGER audit_logs_append_guard_prevent_insert
BEFORE INSERT ON audit_logs_append_guard
WHEN
  NOT EXISTS (
    SELECT 1
    FROM audit_logs
    WHERE id = NEW.audit_id AND event_id = NEW.event_id
  )
  OR EXISTS (
    SELECT 1
    FROM audit_logs_append_guard
    WHERE audit_id = NEW.audit_id OR event_id = NEW.event_id
  )
BEGIN
  SELECT RAISE(ABORT, 'audit_logs append guard is immutable');
END;

CREATE TRIGGER audit_logs_append_guard_prevent_update
BEFORE UPDATE ON audit_logs_append_guard
BEGIN
  SELECT RAISE(ABORT, 'audit_logs append guard is immutable');
END;

CREATE TRIGGER audit_logs_append_guard_prevent_delete
BEFORE DELETE ON audit_logs_append_guard
BEGIN
  SELECT RAISE(ABORT, 'audit_logs append guard is immutable');
END;

INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('audit:read', '監査イベントを閲覧する', 'audit'),
  ('audit:export', '監査イベントを CSV 出力する', 'audit');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'admin'
  AND p.key IN ('audit:read', 'audit:export');
