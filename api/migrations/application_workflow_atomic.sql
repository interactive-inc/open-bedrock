-- 申請行と workflow instance/snapshot を同一 batch で公開するための一時相関キー。
-- batch の最後に NULL へ戻し、初期化途中の pending 行が外部から見える窓をなくす。
ALTER TABLE applications ADD COLUMN workflow_creation_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_workflow_creation
  ON applications (workflow_creation_id)
  WHERE workflow_creation_id IS NOT NULL;
