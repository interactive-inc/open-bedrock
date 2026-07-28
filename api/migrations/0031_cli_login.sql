-- CLI（ネイティブアプリ）ログインのための一時状態を保存する。
-- 1) cli_login_states: GET /auth/cli/login が発行する one-time state。
--    broker に渡す state をキーに、ループバック先のポートと CLI 側 state を保持する。
--    callback で 1 回引いたら削除する（再利用不可）。
-- 2) cli_login_codes: GET /auth/cli/callback が identity 検証・プロビジョニング成功後に
--    払い出す one-time code。トークンは持たず、解決済みの account/employee の id のみを保持する
--    （access/refresh トークンを平文で保存領域に置かないため）。セッションの発行自体は
--    POST /auth/cli/token が code を消費した時点で行う。

CREATE TABLE cli_login_states (
  state TEXT PRIMARY KEY,
  port INTEGER NOT NULL,
  cli_state TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_cli_login_states_expires ON cli_login_states (expires_at);

CREATE TABLE cli_login_codes (
  code_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_cli_login_codes_expires ON cli_login_codes (expires_at);
