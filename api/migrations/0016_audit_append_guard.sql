-- 0015 適用済み環境を forward-only で append guard 方式へ更新する。
-- 0015 の公開後に追加された行と、修正版 0015 で既に guard 済みの環境の両方を扱う。

DROP TRIGGER IF EXISTS audit_logs_prevent_replace;
DROP TRIGGER IF EXISTS audit_logs_register_insert;
DROP TRIGGER IF EXISTS audit_logs_append_guard_prevent_insert;
DROP TRIGGER IF EXISTS audit_logs_append_guard_prevent_update;
DROP TRIGGER IF EXISTS audit_logs_append_guard_prevent_delete;

CREATE TABLE IF NOT EXISTS audit_logs_append_guard (
  audit_id INTEGER NOT NULL UNIQUE,
  event_id TEXT NOT NULL PRIMARY KEY
) WITHOUT ROWID;

INSERT OR IGNORE INTO audit_logs_append_guard (audit_id, event_id)
SELECT id, event_id FROM audit_logs;

-- INSERT OR REPLACE は DELETE trigger を迂回できるため、過去に使ったキーを独立して保持する。
-- INTEGER PRIMARY KEY の BEFORE INSERT では auto-ID の NEW.id が未確定値 -1 になり得るので、
-- 実 ID が確定した AFTER INSERT で guard と照合する。
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
