-- 健康診断・ストレスチェックの実施記録のみ。要配慮個人情報である「結果」は絶対に持たない。
-- 実施年度・種別・実施日・受診状態の記録にとどめ、結果は医療機関・専門サービス側に残す。
CREATE TABLE IF NOT EXISTS health_checkups (
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  fiscal_year INTEGER NOT NULL,
  checkup_kind TEXT NOT NULL,
  conducted_on TEXT,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_health_checkups_employee ON health_checkups (employee_id);

CREATE INDEX IF NOT EXISTS idx_health_checkups_fiscal_year ON health_checkups (fiscal_year);
