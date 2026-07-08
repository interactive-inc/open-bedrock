-- stocktake ドメインの seed
-- 対象テーブル: stocktakes, stocktake_items
-- 値は src/infrastructure/seed/seed-stocktakes.ts / seed-stocktake-items.ts と一致させる。
-- assets は他ドメイン（asset）が seed するため含めない。

INSERT INTO stocktakes (id, name, target_date, status, created_at, closed_at) VALUES
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000001', '2026年上期 棚卸し', '2026-04-01', 'open', '2026-04-01T09:00:00Z', NULL),
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000002', '2025年下期 棚卸し', '2025-10-01', 'closed', '2025-10-01T09:00:00Z', '2025-10-05T18:00:00Z');

INSERT INTO stocktake_items (stocktake_id, asset_code, checked_at, checker_employee_id, location_note) VALUES
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000001', 'A0001', '2026-04-02T10:00:00Z', 1, '5F 開発席'),
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000001', 'A0002', NULL, NULL, NULL),
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000001', 'A0003', NULL, NULL, NULL),
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000001', 'A0004', NULL, NULL, NULL),
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000001', 'A0010', NULL, NULL, NULL),
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000002', 'A0001', '2025-10-03T11:00:00Z', 1, '5F 開発席'),
  ('a1b2c3d4-e5f6-4a1b-8c2d-000000000002', 'A0003', '2025-10-03T11:10:00Z', 1, '倉庫');
