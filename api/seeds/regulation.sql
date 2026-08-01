-- regulation ドメインの seed
-- 規程とその版（改訂履歴を持つものと、廃止済みのものを含む）
-- 値は src/infrastructure/seed/seed-regulations.ts と一致させること。

INSERT INTO regulations (id, code, title, category, status, created_at) VALUES
  (1, 'REG-001', '就業規則', 'labor', 'active', '2025-04-01T09:00:00Z'),
  (2, 'REG-002', '旅費規程', 'expense', 'active', '2025-04-01T09:00:00Z'),
  (3, 'REG-003', '旧服装規定', NULL, 'archived', '2024-01-01T09:00:00Z');

INSERT INTO regulation_versions (id, regulation_id, version, body_md, effective_on, note, created_at) VALUES
  (1, 1, 1, '就業規則の初版。', '2025-04-01', NULL, '2025-04-01T09:00:00Z'),
  (2, 1, 2, 'リモートワークに対応した改訂版就業規則。', '2026-04-01', 'リモートワーク対応の更新', '2026-03-15T09:00:00Z'),
  (3, 2, 1, '旅費規程。', '2025-04-01', NULL, '2025-04-01T09:00:00Z');
