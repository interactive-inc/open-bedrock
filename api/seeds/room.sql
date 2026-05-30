-- room ドメインの seed
-- 会議室マスタと予約。employees / departments は他ドメインが seed するためここでは扱わない。

INSERT INTO rooms (id, name, capacity, location) VALUES
  (1, 'Large Meeting Room A', 20, '5F'),
  (2, 'Medium Meeting Room B', 10, '5F'),
  (3, 'Small Meeting Room C', 6, '4F'),
  (4, 'Focus Booth 1', 2, '4F'),
  (5, 'Online Meeting Room', 8, NULL);

INSERT INTO room_reservations (id, room_id, reserver_id, start_at, end_at, purpose) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 2, '2026-05-29T01:00:00Z', '2026-05-29T02:00:00Z', 'All-hands standup'),
  ('00000000-0000-0000-0000-000000000002', 2, 4, '2026-05-29T03:00:00Z', '2026-05-29T04:00:00Z', 'Sprint review'),
  ('00000000-0000-0000-0000-000000000003', 1, 9, '2026-05-29T05:00:00Z', '2026-05-29T06:00:00Z', 'Sales strategy meeting');
