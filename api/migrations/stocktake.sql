-- 棚卸し（stocktake）。セッション単位で対象資産の現物確認状況を記録する。
-- open は締める前、closed は締めた後。締めると確認記録は変更しない運用。
CREATE TABLE IF NOT EXISTS stocktakes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_stocktakes_status ON stocktakes (status);

-- 棚卸しセッションでの資産ごとの現物確認記録。checked_at が NULL は未確認。
-- 1 セッション 1 資産で 1 行（開始時に対象資産ぶん展開する）。
CREATE TABLE IF NOT EXISTS stocktake_items (
  stocktake_id TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  checked_at TEXT,
  checker_employee_id INTEGER,
  location_note TEXT,
  PRIMARY KEY (stocktake_id, asset_code)
);

CREATE INDEX IF NOT EXISTS idx_stocktake_items_asset ON stocktake_items (asset_code);
