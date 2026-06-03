-- business-trip ドメインの seed
-- 出張申請。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO business_trips (id, traveler_id, destination, start_date, end_date, purpose, estimated_cost, status, created_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 2, 'Osaka Branch', '2026-06-10', '2026-06-12', 'Quarterly partner meeting', 45000, 'requested', '2026-06-01T00:00:00.000Z'),
  ('10000000-0000-0000-0000-000000000002', 4, 'Sapporo Site', '2026-06-20', '2026-06-22', 'On-site equipment inspection', NULL, 'requested', '2026-06-01T00:00:00.000Z'),
  ('10000000-0000-0000-0000-000000000003', 9, 'Fukuoka Office', '2026-07-01', '2026-07-03', 'New hire onboarding support', 38000, 'requested', '2026-06-01T00:00:00.000Z');
