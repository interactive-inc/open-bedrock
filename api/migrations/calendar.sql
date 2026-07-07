-- 会社カレンダー（会社休日と振替出勤日の記録）。通常営業日は行を持たない。判定・計算は持たず記録のみ。
CREATE TABLE IF NOT EXISTS company_calendar_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calendar_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL
);

-- 同一日の重複登録を DB レベルで防ぐ（1 日 1 行）。
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_calendar_days_date ON company_calendar_days (calendar_date);
