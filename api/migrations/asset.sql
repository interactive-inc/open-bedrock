-- 資産台帳（PC・モニタ・什器ほか。在庫/貸出状態と保有者）
CREATE TABLE IF NOT EXISTS assets (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  serial TEXT,
  purchased_on TEXT,
  status TEXT NOT NULL,
  holder_employee_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets (kind);

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (status);

CREATE INDEX IF NOT EXISTS idx_assets_holder ON assets (holder_employee_id);

-- 貸出記録（open は returned_at が NULL。返却で閉じる）
CREATE TABLE IF NOT EXISTS asset_lendings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_code TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  lent_at TEXT NOT NULL,
  returned_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_asset_lendings_asset ON asset_lendings (asset_code);

CREATE INDEX IF NOT EXISTS idx_asset_lendings_employee ON asset_lendings (employee_id);
