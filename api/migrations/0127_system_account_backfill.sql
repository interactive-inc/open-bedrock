-- Wave 43b: legacy Accountをcanonical System Accountへ投影する。
-- read pathは後続Waveまでlegacy tableに残す。

INSERT OR IGNORE INTO system_accounts (
  id,
  status,
  token_version,
  created_at,
  updated_at
)
SELECT
  CAST(id AS TEXT),
  status,
  token_version,
  created_at,
  updated_at
FROM accounts;--> statement-breakpoint

CREATE TABLE system_account_backfill_validation (
  singleton INTEGER PRIMARY KEY NOT NULL
    CHECK (singleton = 1),
  legacy_count INTEGER NOT NULL,
  canonical_count INTEGER NOT NULL,
  mismatch_count INTEGER NOT NULL,
  CHECK (
    legacy_count = canonical_count
    AND mismatch_count = 0
  )
);--> statement-breakpoint

INSERT INTO system_account_backfill_validation (
  singleton,
  legacy_count,
  canonical_count,
  mismatch_count
)
SELECT
  1,
  (SELECT count(*) FROM accounts),
  (SELECT count(*) FROM system_accounts),
  (
    SELECT count(*)
    FROM accounts legacy
    LEFT JOIN system_accounts canonical
      ON canonical.id = CAST(legacy.id AS TEXT)
    WHERE
      CAST(legacy.id AS TEXT) GLOB '*[^0-9]*'
      OR canonical.id IS NULL
      OR canonical.status IS NOT legacy.status
      OR canonical.token_version IS NOT legacy.token_version
      OR canonical.created_at IS NOT legacy.created_at
      OR canonical.updated_at IS NOT legacy.updated_at
  );--> statement-breakpoint

DROP TABLE system_account_backfill_validation;--> statement-breakpoint

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_accounts_legacy_accounts_immutable_identity
BEFORE UPDATE OF id, created_at ON accounts
WHEN
  CAST(NEW.id AS TEXT) IS NOT CAST(OLD.id AS TEXT)
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'legacy account identity is immutable');
END;--> statement-breakpoint

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_accounts_legacy_accounts_insert
AFTER INSERT ON accounts
BEGIN
  SELECT RAISE(ABORT, 'legacy account ID must map to a digit-only opaque ID')
  WHERE CAST(NEW.id AS TEXT) GLOB '*[^0-9]*';

  INSERT INTO system_accounts (
    id,
    status,
    token_version,
    created_at,
    updated_at
  ) VALUES (
    CAST(NEW.id AS TEXT),
    NEW.status,
    NEW.token_version,
    NEW.created_at,
    NEW.updated_at
  );
END;--> statement-breakpoint

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_accounts_legacy_accounts_update_guard
BEFORE UPDATE OF status, token_version, updated_at ON accounts
WHEN NOT EXISTS (
  SELECT 1
  FROM system_accounts canonical
  WHERE
    canonical.id = CAST(OLD.id AS TEXT)
    AND canonical.status IS OLD.status
    AND canonical.token_version IS OLD.token_version
    AND canonical.created_at IS OLD.created_at
    AND canonical.updated_at IS OLD.updated_at
)
BEGIN
  SELECT RAISE(ABORT, 'legacy and canonical account security state diverged');
END;--> statement-breakpoint

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_accounts_legacy_accounts_update
AFTER UPDATE OF status, token_version, updated_at ON accounts
BEGIN
  UPDATE system_accounts
  SET
    status = NEW.status,
    token_version = NEW.token_version,
    updated_at = NEW.updated_at
  WHERE id = CAST(NEW.id AS TEXT);
END;--> statement-breakpoint

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_accounts_legacy_accounts_delete_guard
BEFORE DELETE ON accounts
WHEN NOT EXISTS (
  SELECT 1
  FROM system_accounts canonical
  WHERE
    canonical.id = CAST(OLD.id AS TEXT)
    AND canonical.status IS OLD.status
    AND canonical.token_version IS OLD.token_version
    AND canonical.created_at IS OLD.created_at
    AND canonical.updated_at IS OLD.updated_at
)
BEGIN
  SELECT RAISE(ABORT, 'legacy and canonical account security state diverged');
END;--> statement-breakpoint

/* DDL-only test harnesses skip compound triggers. Full migration loaders apply this statement. */
CREATE TRIGGER system_accounts_legacy_accounts_delete
AFTER DELETE ON accounts
BEGIN
  DELETE FROM system_accounts WHERE id = CAST(OLD.id AS TEXT);
END;--> statement-breakpoint
