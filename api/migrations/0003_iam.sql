-- IAM 認証・認可: アカウント分離 + 動的ロール + 機能別権限。
-- D1 慣習に従い FK 制約は張らず論理参照、整合は unique/複合PK/部分index + アプリ層 + 監査で担保。
-- 依存順(roles→permissions→role_permissions / accounts→identities/account_roles)を 1 ファイル内で保証。

-- 認証主体。従業員台帳から分離する。employee_id は論理参照(null 可でシステムアカウント余地)。
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER,
  status TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 1 従業員 = 1 アカウント(employee_id が非 NULL のとき一意)。
CREATE UNIQUE INDEX uniq_accounts_employee ON accounts (employee_id) WHERE employee_id IS NOT NULL;

-- ログイン手段(多態)。password は PBKDF2 を secret に、OAuth は IdP の sub を subject に持つ。
CREATE TABLE identities (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  secret TEXT,
  email TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 同一 (provider, subject) の二重紐付け(乗っ取り経路)を封じる。
CREATE UNIQUE INDEX uniq_identities_provider_subject ON identities (provider, subject);
CREATE INDEX idx_identities_account ON identities (account_id);

-- ロール。system role(member/manager/hr/admin)は is_system=1 で key 改名・削除不可。任意の動的ロールも追加可。
CREATE TABLE roles (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 権限カタログ(UI 用の写し)。正はコードの PERMISSION_KEYS。
CREATE TABLE permissions (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL
);

-- ロールが持つ権限。
CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

-- アカウントに割り当てたロール。複数可、実効権限は和集合。granted_by で付与者を監査。
CREATE TABLE account_roles (
  account_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  granted_by INTEGER,
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, role_id)
);

-- refresh token。生は保存せず SHA-256 のみ。family_id で再利用検知し family 全失効。
CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  family_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_refresh_tokens_account ON refresh_tokens (account_id);

-- 監査ログ(append-only)。認証・認可・IAM 変更を記録。UPDATE/DELETE はアプリ層で禁止。
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  actor_account_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  metadata TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_account_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
