-- 意思決定記録（ADR 形式。文脈・決定・帰結を記録し、後続の決定で supersede する）
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  decided_on TEXT NOT NULL,
  context TEXT NOT NULL,
  decision TEXT NOT NULL,
  consequences TEXT,
  status TEXT NOT NULL,
  superseded_by_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions (status);
