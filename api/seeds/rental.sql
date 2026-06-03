-- rental ドメインの seed
-- レンタル予約申請。employees は他ドメインが seed するためここでは扱わない。

INSERT INTO rental_reservations (id, requester_id, item_name, start_date, end_date, purpose, status, created_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 2, 'Projector', '2026-06-10', '2026-06-12', 'Client presentation', 'requested', '2026-06-01T00:00:00Z'),
  ('10000000-0000-0000-0000-000000000002', 4, 'Laptop', '2026-06-15', '2026-06-20', NULL, 'requested', '2026-06-01T00:00:00Z'),
  ('10000000-0000-0000-0000-000000000003', 9, 'Camera', '2026-06-18', '2026-06-19', 'Event recording', 'requested', '2026-06-01T00:00:00Z');
