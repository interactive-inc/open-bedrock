-- 取引先台帳（顧客・仕入先ほか。反社チェック・契約記録の親マスタ）
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  corporate_number TEXT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partners_status ON partners (status);

-- 契約記録（契約日・期間・更新期限の事実記録。中身のレビューや法的判定はしない）
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  contract_date TEXT NOT NULL,
  starts_on TEXT,
  ends_on TEXT,
  renewal_deadline TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_partner ON contracts (partner_id);
