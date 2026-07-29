-- leave_balances の granted_days/used_days/remaining_days を、半休・時間休の按分（0.5日、時間数/8）
-- を保持できるよう REAL 型へ変更する。SQLite は ALTER COLUMN 型変更に対応しないため、
-- テーブルを再作成して差し替える（外部キー参照なし）。
CREATE TABLE leave_balances_new (
  employee_id INTEGER NOT NULL,
  fiscal_year TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  granted_days REAL NOT NULL,
  used_days REAL NOT NULL,
  remaining_days REAL NOT NULL,
  PRIMARY KEY (employee_id, fiscal_year, leave_type)
);

INSERT INTO leave_balances_new SELECT * FROM leave_balances;

DROP TABLE leave_balances;

ALTER TABLE leave_balances_new RENAME TO leave_balances;

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON leave_balances (employee_id, fiscal_year);
