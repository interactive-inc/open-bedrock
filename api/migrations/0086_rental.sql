-- 物のレンタル予約（外部からの貸与品の予約申請。期間と用途を記録）
CREATE TABLE IF NOT EXISTS rental_reservations (
  id TEXT PRIMARY KEY,
  requester_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  purpose TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rental_reservations_requester ON rental_reservations (requester_id);
