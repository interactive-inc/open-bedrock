-- 承認フロー定義を楽観ロックし、誰がどの版を保存したかを追跡する。
-- 既存行は revision=1 とし、移行前の更新者は復元できないため NULL で明示する。
ALTER TABLE application_workflows
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

ALTER TABLE application_workflows
  ADD COLUMN updated_by_account_id INTEGER;

CREATE TABLE application_workflow_revisions (
  template_id INTEGER NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  definition_json TEXT NOT NULL,
  updated_by_account_id INTEGER,
  created_at TEXT NOT NULL,
  PRIMARY KEY (template_id, revision)
);

INSERT INTO application_workflow_revisions
  (template_id, revision, definition_json, updated_by_account_id, created_at)
SELECT template_id, revision, definition_json, updated_by_account_id, updated_at
FROM application_workflows;

-- 履歴は追記専用。テンプレートを削除しても過去の定義と監査主体を残す。
CREATE TRIGGER application_workflow_revisions_no_update
BEFORE UPDATE ON application_workflow_revisions
BEGIN
  SELECT RAISE(ABORT, 'application_workflow_revisions is append-only');
END;

CREATE TRIGGER application_workflow_revisions_no_delete
BEFORE DELETE ON application_workflow_revisions
BEGIN
  SELECT RAISE(ABORT, 'application_workflow_revisions is append-only');
END;
