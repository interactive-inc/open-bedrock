-- 監査付き batch が transaction 内で排他的な結果を選ぶための一時 decision marker。
-- 成功経路では同じ batch 内で必ず削除し、永続的な業務情報は保持しない。
CREATE TABLE audit_batch_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_value TEXT NOT NULL,
  CHECK (length(decision_id) BETWEEN 1 AND 200),
  CHECK (length(decision_value) BETWEEN 1 AND 64)
) WITHOUT ROWID;
