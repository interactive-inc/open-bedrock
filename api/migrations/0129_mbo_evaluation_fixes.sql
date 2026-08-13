-- MBO 評価シートの修正: revision カラム追加、unique 制約を完全一意に変更。

-- 楽観的ロック用の revision カラムを追加（CAS パターン）。
ALTER TABLE evaluation_sheets ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

-- 部分 unique index を削除し、完全な一意制約に変更。
-- 同一社員・同一評価期にシートは 1 枚のみ許可する（reopen 時の競合を防止）。
DROP INDEX IF EXISTS uq_evaluation_sheets_employee_period_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evaluation_sheets_employee_period
ON evaluation_sheets (employee_id, period);
