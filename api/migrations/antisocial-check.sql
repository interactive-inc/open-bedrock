-- 反社チェックの申請（取引先の確認情報と判定結果を記録）
CREATE TABLE IF NOT EXISTS antisocial_checks (
  id TEXT PRIMARY KEY,
  requester_id INTEGER NOT NULL,
  partner_name TEXT NOT NULL,
  partner_address TEXT,
  representative_name TEXT,
  result TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_antisocial_checks_requester ON antisocial_checks (requester_id);
