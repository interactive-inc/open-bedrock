-- antisocial-check ドメインの seed
-- 反社チェック申請。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO antisocial_checks (id, requester_id, partner_name, partner_address, representative_name, result, status, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 2, 'Example Trading Co.', '1-2-3 Sample, Example City', 'Pat Example', NULL, 'requested', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000002', 4, 'Sample Logistics Inc.', NULL, NULL, 'clear', 'requested', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000003', 9, 'Demo Partners LLC', '4-5-6 Placeholder, Example City', 'Alex Sample', NULL, 'requested', '2026-06-01T00:00:00.000Z');
