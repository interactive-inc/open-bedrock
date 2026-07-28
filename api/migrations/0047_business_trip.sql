-- 出張申請（行き先・期間・目的・概算費用の記録。金額の計算や判定は持たず記録のみ）
CREATE TABLE IF NOT EXISTS business_trips (
  id TEXT PRIMARY KEY,
  traveler_id INTEGER NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  purpose TEXT NOT NULL,
  estimated_cost INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_business_trips_traveler ON business_trips (traveler_id);
