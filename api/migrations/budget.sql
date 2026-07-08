-- 部署予算（部署・会計期間・金額の記録）。消化額はスナップショットせず、承認済み経費の読み取り集計で算出する。
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL,
  fiscal_period TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  amount INTEGER NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_budgets_department ON budgets (department_id);

CREATE INDEX IF NOT EXISTS idx_budgets_fiscal_period ON budgets (fiscal_period);

-- budget:manage 権限を追加し、hr / admin に付与する。0004_iam_seed.sql と同じく INSERT OR IGNORE で冪等に追加する。
INSERT OR IGNORE INTO permissions (key, description, category) VALUES
  ('budget:manage', '部署予算を管理する', 'budget');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.key IN ('hr', 'admin')
    AND p.key = 'budget:manage';
