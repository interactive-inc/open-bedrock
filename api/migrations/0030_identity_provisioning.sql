-- 外部 identity provider（OIDC ブローカー）連携の受け口を整える。
-- 1) プロビジョニングで作る従業員は社員コードを持たない場合があるため employees.code を null 許容へ緩める。
--    SQLite は ALTER で NOT NULL を外せないため、テーブルを作り直して移送する（既存データは保全）。
--    UNIQUE は維持する（SQLite は複数 NULL を互いに異なる値として扱うため null 許容と両立する）。
-- 2) 外部 identity トークンの再利用（replay）を防ぐため、使用済み jti を短命に記録する台帳を追加する。

-- ---- 1) employees.code を null 許容へ ----
-- 依存インデックスを先に落とす（列を含む索引があるとテーブル作り直しの妨げになるため）。
DROP INDEX IF EXISTS idx_employees_code;

CREATE TABLE employees_new (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  dept_id INTEGER,
  dept_name TEXT,
  position TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'leave', 'retired')),
  archived_at INTEGER,
  archived_by_account_id INTEGER
);

INSERT INTO employees_new (
  id, code, name, dept_id, dept_name, position, status, archived_at, archived_by_account_id
)
SELECT id, code, name, dept_id, dept_name, position, status, archived_at, archived_by_account_id
FROM employees;

DROP TABLE employees;

ALTER TABLE employees_new RENAME TO employees;

CREATE INDEX idx_employees_code ON employees (code);

-- ---- 2) 外部 identity トークンの replay 記録 ----
-- 外部 IdP が発行する短命 JWT の jti を、使用時に一意記録する。二重使用は UNIQUE 制約で拒否する。
-- expires_at はトークンの exp（epoch 秒）。失効済みの記録は定期削除できるが、保持しても安全側に働く。
CREATE TABLE identity_login_jti (
  jti TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  used_at INTEGER NOT NULL
);

CREATE INDEX idx_identity_login_jti_expires ON identity_login_jti (expires_at);
