-- MBO（目標管理）機能: 評価テンプレート・評価シート・監査ログ。
-- 既存の performance_goals / one_on_ones に evaluation_sheet_id を追加し、
-- 個別の目標・面談を評価シートの傘下に束ねる。

-- 評価テンプレート（期間ごとの評価項目雛形）。items は JSON 配列で保存する。
CREATE TABLE IF NOT EXISTS evaluation_templates (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  items TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluation_templates_period
ON evaluation_templates (period);

CREATE INDEX IF NOT EXISTS idx_evaluation_templates_status
ON evaluation_templates (status);

-- 評価シート（評価期 × 社員。MBO の中心エンティティ）。
-- primary/secondary_evaluator_id はシート作成時に org_memberships から解決して固定する。
-- 異動後も評価期間中は変わらない。HR/admin のみ手動変更可（audit_log 記録）。
CREATE TABLE IF NOT EXISTS evaluation_sheets (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  template_id INTEGER,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  primary_evaluator_id INTEGER NOT NULL,
  secondary_evaluator_id INTEGER,
  submitted_at TEXT,
  approved_at TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluation_sheets_employee
ON evaluation_sheets (employee_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_sheets_period
ON evaluation_sheets (period);

CREATE INDEX IF NOT EXISTS idx_evaluation_sheets_status
ON evaluation_sheets (status);

-- 同一社員・同一評価期に active なシートは 1 枚まで（finalized/archived は複数可）。
CREATE UNIQUE INDEX IF NOT EXISTS uq_evaluation_sheets_employee_period_active
ON evaluation_sheets (employee_id, period)
WHERE status NOT IN ('finalized', 'archived');

-- 評価シートの監査ログ（操作の事実記録）。
CREATE TABLE IF NOT EXISTS evaluation_sheet_audit_logs (
  id INTEGER PRIMARY KEY,
  sheet_id INTEGER NOT NULL,
  actor_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluation_sheet_audit_logs_sheet
ON evaluation_sheet_audit_logs (sheet_id);

-- performance_goals に evaluation_sheet_id を追加し、目標をシートに紐付ける。
-- 既存行は紐付けなし(NULL)で残る。
ALTER TABLE performance_goals ADD COLUMN evaluation_sheet_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_performance_goals_evaluation_sheet
ON performance_goals (evaluation_sheet_id);

-- one_on_ones に evaluation_sheet_id を追加し、面談メモをシートに紐付け可能にする。
ALTER TABLE one_on_ones ADD COLUMN evaluation_sheet_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_one_on_ones_evaluation_sheet
ON one_on_ones (evaluation_sheet_id);

-- evaluation:administer 権限を permissions テーブルに登録し、hr/root ロールに付与する。
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('evaluation:administer', '評価テンプレート・評価シートを管理する', 'evaluation');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'hr' AND p.key IN ('evaluation:administer');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key = 'root' AND p.key IN ('evaluation:administer');
