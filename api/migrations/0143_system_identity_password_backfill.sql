-- legacy Account / identity / passwordをcanonical Systemへ投影する。
-- legacyの時刻はhistorical writerによりepoch秒・millisecondが混在し得るため、
-- 100,000,000,000未満の非zero値だけを秒とみなしてmillisecondへ正規化する。

DROP TRIGGER system_accounts_monotonic_security_state;
DROP TRIGGER system_accounts_legacy_accounts_immutable_identity;
DROP TRIGGER system_accounts_legacy_accounts_insert;
DROP TRIGGER system_accounts_legacy_accounts_update_guard;
DROP TRIGGER system_accounts_legacy_accounts_update;
DROP TRIGGER system_accounts_legacy_accounts_delete_guard;
DROP TRIGGER system_accounts_legacy_accounts_delete;

CREATE TABLE system_account_time_normalization_validation (
  singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
  mismatch_count INTEGER NOT NULL CHECK (mismatch_count = 0)
);

INSERT INTO system_account_time_normalization_validation (singleton, mismatch_count)
SELECT 1, count(*)
FROM accounts legacy
LEFT JOIN system_accounts canonical ON canonical.id = CAST(legacy.id AS TEXT)
WHERE canonical.id IS NULL
   OR canonical.status IS NOT legacy.status
   OR canonical.token_version IS NOT legacy.token_version
   OR canonical.created_at IS NOT legacy.created_at
   OR canonical.updated_at IS NOT legacy.updated_at;

DROP TABLE system_account_time_normalization_validation;

UPDATE system_accounts
SET
  created_at = CASE
    WHEN created_at != 0 AND abs(created_at) < 100000000000 THEN created_at * 1000
    ELSE created_at
  END,
  updated_at = CASE
    WHEN updated_at != 0 AND abs(updated_at) < 100000000000 THEN updated_at * 1000
    ELSE updated_at
  END;

CREATE TRIGGER system_accounts_monotonic_security_state
BEFORE UPDATE ON system_accounts
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.token_version < OLD.token_version
  OR NEW.updated_at < OLD.updated_at
  OR (
    NEW.status IS NOT OLD.status
    AND NEW.token_version IS NOT OLD.token_version + 1
  )
BEGIN
  SELECT RAISE(ABORT, 'account security state is not monotonic');
END;

CREATE TRIGGER system_accounts_legacy_accounts_immutable_identity
BEFORE UPDATE OF id, created_at ON accounts
WHEN
  CAST(NEW.id AS TEXT) IS NOT CAST(OLD.id AS TEXT)
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'legacy account identity is immutable');
END;

CREATE TRIGGER system_accounts_legacy_accounts_insert
AFTER INSERT ON accounts
BEGIN
  SELECT RAISE(ABORT, 'legacy account ID must map to a digit-only opaque ID')
  WHERE CAST(NEW.id AS TEXT) GLOB '*[^0-9]*';

  INSERT INTO system_accounts (
    id, status, token_version, created_at, updated_at
  ) VALUES (
    CAST(NEW.id AS TEXT),
    NEW.status,
    NEW.token_version,
    CASE
      WHEN NEW.created_at != 0 AND abs(NEW.created_at) < 100000000000
      THEN NEW.created_at * 1000 ELSE NEW.created_at
    END,
    CASE
      WHEN NEW.updated_at != 0 AND abs(NEW.updated_at) < 100000000000
      THEN NEW.updated_at * 1000 ELSE NEW.updated_at
    END
  );
END;

CREATE TRIGGER system_accounts_legacy_accounts_update_guard
BEFORE UPDATE OF status, token_version, updated_at ON accounts
WHEN NOT EXISTS (
  SELECT 1
  FROM system_accounts canonical
  WHERE
    canonical.id = CAST(OLD.id AS TEXT)
    AND canonical.status IS OLD.status
    AND canonical.token_version IS OLD.token_version
    AND canonical.created_at IS CASE
      WHEN OLD.created_at != 0 AND abs(OLD.created_at) < 100000000000
      THEN OLD.created_at * 1000 ELSE OLD.created_at
    END
    AND canonical.updated_at IS CASE
      WHEN OLD.updated_at != 0 AND abs(OLD.updated_at) < 100000000000
      THEN OLD.updated_at * 1000 ELSE OLD.updated_at
    END
)
BEGIN
  SELECT RAISE(ABORT, 'legacy and canonical account security state diverged');
END;

CREATE TRIGGER system_accounts_legacy_accounts_update
AFTER UPDATE OF status, token_version, updated_at ON accounts
BEGIN
  UPDATE system_accounts
  SET
    status = NEW.status,
    token_version = NEW.token_version,
    updated_at = CASE
      WHEN NEW.updated_at != 0 AND abs(NEW.updated_at) < 100000000000
      THEN NEW.updated_at * 1000 ELSE NEW.updated_at
    END
  WHERE id = CAST(NEW.id AS TEXT);
END;

CREATE TRIGGER system_accounts_legacy_accounts_delete_guard
BEFORE DELETE ON accounts
WHEN NOT EXISTS (
  SELECT 1
  FROM system_accounts canonical
  WHERE
    canonical.id = CAST(OLD.id AS TEXT)
    AND canonical.status IS OLD.status
    AND canonical.token_version IS OLD.token_version
    AND canonical.created_at IS CASE
      WHEN OLD.created_at != 0 AND abs(OLD.created_at) < 100000000000
      THEN OLD.created_at * 1000 ELSE OLD.created_at
    END
    AND canonical.updated_at IS CASE
      WHEN OLD.updated_at != 0 AND abs(OLD.updated_at) < 100000000000
      THEN OLD.updated_at * 1000 ELSE OLD.updated_at
    END
)
BEGIN
  SELECT RAISE(ABORT, 'legacy and canonical account security state diverged');
END;

CREATE TRIGGER system_accounts_legacy_accounts_delete
AFTER DELETE ON accounts
BEGIN
  DELETE FROM system_accounts WHERE id = CAST(OLD.id AS TEXT);
END;

SELECT CASE WHEN EXISTS (
  SELECT 1 FROM identities
  WHERE provider NOT IN ('password', 'google', 'github', 'oidc')
) THEN json_extract('', '$') ELSE 1 END AS supported_identity_providers;

INSERT INTO system_identity_bindings (
  id, account_id, provider, subject, created_at, activated_at, revoked_at
)
SELECT
  CAST(id AS TEXT),
  CAST(account_id AS TEXT),
  provider,
  subject,
  CASE
    WHEN created_at != 0 AND abs(created_at) < 100000000000 THEN created_at * 1000
    ELSE created_at
  END,
  CASE
    WHEN created_at != 0 AND abs(created_at) < 100000000000 THEN created_at * 1000
    ELSE created_at
  END,
  NULL
FROM identities;

INSERT INTO system_password_credentials (
  identity_id, password_hash, changed_at, created_at, updated_at
)
SELECT
  CAST(id AS TEXT),
  secret,
  CASE
    WHEN created_at != 0 AND abs(created_at) < 100000000000 THEN created_at * 1000
    ELSE created_at
  END,
  CASE
    WHEN created_at != 0 AND abs(created_at) < 100000000000 THEN created_at * 1000
    ELSE created_at
  END,
  CASE
    WHEN created_at != 0 AND abs(created_at) < 100000000000 THEN created_at * 1000
    ELSE created_at
  END
FROM identities
WHERE provider = 'password' AND secret IS NOT NULL;

SELECT CASE WHEN
  (
    SELECT count(*)
    FROM identities legacy
    LEFT JOIN system_identity_bindings canonical
      ON canonical.id = CAST(legacy.id AS TEXT)
    WHERE canonical.id IS NULL
      OR canonical.account_id IS NOT CAST(legacy.account_id AS TEXT)
      OR canonical.provider IS NOT legacy.provider
      OR canonical.subject IS NOT legacy.subject
  ) = 0
  AND (
    SELECT count(*)
    FROM identities legacy
    LEFT JOIN system_password_credentials canonical
      ON canonical.identity_id = CAST(legacy.id AS TEXT)
    WHERE legacy.provider = 'password'
      AND legacy.secret IS NOT NULL
      AND canonical.password_hash IS NOT legacy.secret
  ) = 0
THEN 1 ELSE json_extract('', '$') END AS identity_password_projection_complete;

CREATE TRIGGER system_identities_legacy_provider_guard
BEFORE INSERT ON identities
WHEN NEW.provider NOT IN ('password', 'google', 'github', 'oidc')
BEGIN
  SELECT RAISE(ABORT, 'unsupported legacy identity provider');
END;

CREATE TRIGGER system_identities_legacy_immutable_identity
BEFORE UPDATE OF id, account_id, provider, subject, created_at ON identities
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.provider IS NOT OLD.provider
  OR NEW.subject IS NOT OLD.subject
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'legacy identity binding identity is immutable');
END;

CREATE TRIGGER system_identities_legacy_insert
AFTER INSERT ON identities
BEGIN
  INSERT INTO system_identity_bindings (
    id, account_id, provider, subject, created_at, activated_at, revoked_at
  ) VALUES (
    CAST(NEW.id AS TEXT),
    CAST(NEW.account_id AS TEXT),
    NEW.provider,
    NEW.subject,
    CASE
      WHEN NEW.created_at != 0 AND abs(NEW.created_at) < 100000000000
      THEN NEW.created_at * 1000 ELSE NEW.created_at
    END,
    CASE
      WHEN NEW.created_at != 0 AND abs(NEW.created_at) < 100000000000
      THEN NEW.created_at * 1000 ELSE NEW.created_at
    END,
    NULL
  );

  INSERT INTO system_password_credentials (
    identity_id, password_hash, changed_at, created_at, updated_at
  )
  SELECT
    CAST(NEW.id AS TEXT),
    NEW.secret,
    binding.created_at,
    binding.created_at,
    binding.created_at
  FROM system_identity_bindings binding
  WHERE binding.id = CAST(NEW.id AS TEXT)
    AND NEW.provider = 'password'
    AND NEW.secret IS NOT NULL;
END;

CREATE TRIGGER system_identities_legacy_password_update
AFTER UPDATE OF secret ON identities
WHEN NEW.provider = 'password' AND NEW.secret IS NOT NULL AND NEW.secret IS NOT OLD.secret
BEGIN
  INSERT INTO system_password_credentials (
    identity_id, password_hash, changed_at, created_at, updated_at
  )
  SELECT
    CAST(NEW.id AS TEXT),
    NEW.secret,
    max(binding.created_at, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    binding.created_at,
    max(binding.created_at, CAST(strftime('%s', 'now') AS INTEGER) * 1000)
  FROM system_identity_bindings binding
  WHERE binding.id = CAST(NEW.id AS TEXT)
  ON CONFLICT(identity_id) DO UPDATE SET
    password_hash = excluded.password_hash,
    changed_at = max(system_password_credentials.changed_at + 1, excluded.changed_at),
    updated_at = max(system_password_credentials.updated_at + 1, excluded.updated_at);
END;

CREATE TRIGGER system_identities_legacy_password_remove
AFTER UPDATE OF secret ON identities
WHEN NEW.provider = 'password' AND NEW.secret IS NULL AND OLD.secret IS NOT NULL
BEGIN
  DELETE FROM system_password_credentials WHERE identity_id = CAST(NEW.id AS TEXT);
END;

CREATE TRIGGER system_identities_legacy_delete
BEFORE DELETE ON identities
BEGIN
  DELETE FROM system_password_credentials WHERE identity_id = CAST(OLD.id AS TEXT);
  DELETE FROM system_identity_bindings WHERE id = CAST(OLD.id AS TEXT);
END;
