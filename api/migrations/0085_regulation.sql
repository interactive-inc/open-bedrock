-- 規程集（就業規則などの版管理台帳）。規程本体は regulations、各改定版は regulation_versions。
CREATE TABLE IF NOT EXISTS regulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_regulations_status ON regulations (status);

-- 規程の改定版（version は整数の連番。同一規程内で version は一意）。
CREATE TABLE IF NOT EXISTS regulation_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regulation_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  effective_on TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (regulation_id, version)
);

CREATE INDEX IF NOT EXISTS idx_regulation_versions_regulation ON regulation_versions (regulation_id);
