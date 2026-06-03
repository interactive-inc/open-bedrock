-- 証明書発行依頼（在職・就労・退職証明書などの発行依頼を記録）
CREATE TABLE IF NOT EXISTS certificate_requests (
  id TEXT PRIMARY KEY,
  requester_id INTEGER NOT NULL,
  certificate_type TEXT NOT NULL,
  submit_to TEXT,
  needed_by TEXT,
  note TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_certificate_requests_requester ON certificate_requests (requester_id);
