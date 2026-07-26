-- ブラウザへのログイン受け渡し（browser login handoff）のための一時状態を保存する。
-- browser_login_codes: POST /auth/browser/code が認証済みの呼び出し元に払い出す one-time code。
-- トークンは持たず、呼び出し元セッションの account/employee の id のみを保持する
-- （access/refresh トークンを平文で保存領域に置かないため）。セッションの発行自体は
-- POST /auth/browser/token が code を消費した時点で行う。

CREATE TABLE browser_login_codes (
  code_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_browser_login_codes_expires ON browser_login_codes (expires_at);
