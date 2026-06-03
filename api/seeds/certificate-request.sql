-- certificate-request ドメインの seed
-- 証明書発行依頼。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO certificate_requests (id, requester_id, certificate_type, submit_to, needed_by, note, status, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 2, 'employment', 'City Hall', '2026-06-20', 'For childcare application', 'requested', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000002', 4, 'income', NULL, NULL, NULL, 'requested', '2026-06-01T00:00:00.000Z'),
  ('20000000-0000-0000-0000-000000000003', 9, 'retirement', 'Pension Office', '2026-07-05', NULL, 'requested', '2026-06-01T00:00:00.000Z');
