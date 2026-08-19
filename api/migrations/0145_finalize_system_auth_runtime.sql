CREATE TABLE system_password_reset_challenges (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  token_hash TEXT NOT NULL
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE RESTRICT,
  identity_id TEXT NOT NULL
    REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
    CHECK (expires_at > created_at),
  used_at INTEGER
    CHECK (used_at IS NULL OR used_at >= created_at)
);

CREATE UNIQUE INDEX system_password_reset_challenges_token_hash_uniq
  ON system_password_reset_challenges (token_hash);
CREATE INDEX system_password_reset_challenges_account_idx
  ON system_password_reset_challenges (account_id, created_at);
CREATE INDEX system_password_reset_challenges_expires_idx
  ON system_password_reset_challenges (expires_at);

CREATE TRIGGER system_password_reset_challenges_password_identity_insert
BEFORE INSERT ON system_password_reset_challenges
WHEN NOT EXISTS (
  SELECT 1 FROM system_identity_bindings
  WHERE id = NEW.identity_id
    AND account_id = NEW.account_id
    AND provider = 'password'
    AND activated_at IS NOT NULL
    AND revoked_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'password reset challenge requires an active password identity');
END;

CREATE TRIGGER system_password_reset_challenges_monotonic_use
BEFORE UPDATE ON system_password_reset_challenges
WHEN
  NEW.id IS NOT OLD.id
  OR NEW.token_hash IS NOT OLD.token_hash
  OR NEW.account_id IS NOT OLD.account_id
  OR NEW.identity_id IS NOT OLD.identity_id
  OR NEW.created_at IS NOT OLD.created_at
  OR NEW.expires_at IS NOT OLD.expires_at
  OR (OLD.used_at IS NOT NULL AND NEW.used_at IS NOT OLD.used_at)
BEGIN
  SELECT RAISE(ABORT, 'password reset challenge lifecycle is not monotonic');
END;

CREATE TABLE system_authentication_attempts (
  id TEXT PRIMARY KEY NOT NULL
    CHECK (length(id) BETWEEN 1 AND 255),
  identifier TEXT NOT NULL
    CHECK (length(identifier) BETWEEN 1 AND 2048),
  ip TEXT
    CHECK (ip IS NULL OR length(ip) BETWEEN 1 AND 255),
  attempted_at INTEGER NOT NULL
);

CREATE INDEX system_authentication_attempts_identifier_attempted_at_idx
  ON system_authentication_attempts (identifier, attempted_at);
CREATE INDEX system_authentication_attempts_ip_attempted_at_idx
  ON system_authentication_attempts (ip, attempted_at);
