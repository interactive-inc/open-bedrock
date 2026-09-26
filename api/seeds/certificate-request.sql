-- certificate-request ドメインの seed
-- 証明書発行依頼。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO certificate_requests (id, requester_id, certificate_type, submit_to, needed_by, note, status, created_at) VALUES
  ('01900005-0000-7000-8000-000000000001', '01900062-0000-7000-8000-000000000002', 'employment', '市役所', '2026-06-20', '保育園申請のため', 'requested', '2026-06-01T00:00:00.000Z'),
  ('01900005-0000-7000-8000-000000000002', '01900062-0000-7000-8000-000000000004', 'income', NULL, NULL, NULL, 'requested', '2026-06-01T00:00:00.000Z'),
  ('01900005-0000-7000-8000-000000000003', '01900062-0000-7000-8000-000000000009', 'retirement', '年金事務所', '2026-07-05', NULL, 'requested', '2026-06-01T00:00:00.000Z');
