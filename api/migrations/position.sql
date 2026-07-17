-- 役職マスタ（並び順の rank を持つ役職の定義）。判定・計算は持たず定義のみ。
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

-- 役職コードは全社で一意（同一コードの二重登録を防ぐ）。
CREATE UNIQUE INDEX IF NOT EXISTS uq_positions_code ON positions (code);
