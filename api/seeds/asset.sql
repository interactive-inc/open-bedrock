-- asset ドメインの seed
-- 対象テーブル: assets, asset_lendings
-- 値は src/infrastructure/seed/seed-assets.ts / seed-asset-lendings.ts と一致させる（テスト期待値と整合）。
-- employees は他ドメイン（employee）が seed するため含めない。

INSERT INTO assets (code, name, kind, serial, purchased_on, status, holder_employee_id, disposed_on, disposal_reason) VALUES
  ('A0001', '標準ノートPC 14インチ', 'pc', 'PF-X1-0001', '2024-04-01', 'lent', 5, NULL, NULL),
  ('A0002', '外付けモニター 27インチ', 'monitor', 'CN-D27-0002', '2024-04-01', 'lent', 9, NULL, NULL),
  ('A0003', '高性能ノートPC 14インチ', 'pc', 'C02-MBP-0003', '2024-06-15', 'in_stock', NULL, NULL, NULL),
  ('A0004', '貸与スマートフォン', 'mobile', 'IP-15-0004', '2024-09-01', 'in_stock', NULL, NULL, NULL),
  ('A0010', 'メッシュオフィスチェア', 'furniture', NULL, NULL, 'in_stock', NULL, NULL, NULL),
  ('A0011', '旧標準ノートPC 13インチ', 'pc', 'PF-X0-0011', '2020-04-01', 'disposed', NULL, '2026-03-31', '経年劣化のため廃棄');

INSERT INTO asset_lendings (id, asset_code, employee_id, lent_at, returned_at) VALUES
  (1, 'A0001', 5, '2026-04-01T09:00:00Z', NULL),
  (2, 'A0002', 9, '2026-04-01T09:00:00Z', NULL),
  (3, 'A0003', 5, '2025-12-01T09:00:00Z', '2026-03-31T18:00:00Z');
