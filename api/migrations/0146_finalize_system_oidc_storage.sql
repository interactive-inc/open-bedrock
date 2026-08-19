DROP TABLE IF EXISTS oidc_access_tokens;
DROP TABLE IF EXISTS oidc_authorization_codes;
DROP TABLE IF EXISTS user_identities;
DROP TABLE IF EXISTS bootstrap_state;
DROP TABLE IF EXISTS entity_id_aliases;
DROP TABLE IF EXISTS deleted_records;
DROP TABLE IF EXISTS users;

CREATE TABLE system_oidc_authorization_codes (
  code_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(code_hash) = 64 AND code_hash NOT GLOB '*[^0-9a-f]*'),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  code_challenge TEXT NOT NULL,
  nonce TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX system_oidc_authorization_codes_expires_idx
  ON system_oidc_authorization_codes (expires_at);

CREATE TABLE system_oidc_access_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL
    CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  account_id TEXT NOT NULL
    REFERENCES system_accounts(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX system_oidc_access_tokens_expires_idx
  ON system_oidc_access_tokens (expires_at);
