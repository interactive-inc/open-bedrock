-- antisocial-check ドメインの seed
-- 反社チェック申請。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO antisocial_checks (id, requester_id, partner_name, partner_address, representative_name, result, status, created_at) VALUES
  ('0190000a-0000-7000-8000-000000000001', 2, '株式会社サンプル商事', '東京都サンプル区サンプル1-2-3', '山田 サンプル', NULL, 'requested', '2026-06-01T00:00:00.000Z'),
  ('0190000a-0000-7000-8000-000000000002', 4, 'サンプル物流株式会社', NULL, NULL, 'clear', 'requested', '2026-06-01T00:00:00.000Z'),
  ('0190000a-0000-7000-8000-000000000003', 9, 'デモパートナーズ合同会社', '大阪府サンプル市サンプル4-5-6', '鈴木 サンプル', NULL, 'requested', '2026-06-01T00:00:00.000Z');
