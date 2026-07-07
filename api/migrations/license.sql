-- ライセンス・SaaS 台帳（利用中のライセンスと更新期限・管理担当の事実記録）。
-- 支払や会計連動は持たず、更新期限の把握と棚卸しのための記録のみ。
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vendor TEXT,
  category TEXT,
  seats INTEGER,
  renewal_deadline TEXT,
  owner_employee_id INTEGER,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 更新期限が近い順の走査に使う。
CREATE INDEX IF NOT EXISTS idx_licenses_renewal_deadline ON licenses (renewal_deadline);
