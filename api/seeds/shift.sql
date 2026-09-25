-- shift ドメインの seed
-- 対象テーブル: shift_patterns / shift_assignments / shift_swap_requests
-- migration: migrations/shift.sql / 値: src/infrastructure/seed/seed-shift-patterns.ts, seed-shift-assignments.ts, seed-shift-swap-requests.ts

INSERT INTO shift_patterns (id, code, name, start_time, end_time, break_minutes) VALUES
  ('01900023-0000-7000-8000-000000000001', 'EARLY', '早番', '07:00', '16:00', 60),
  ('01900023-0000-7000-8000-000000000002', 'LATE', '遅番', '13:00', '22:00', 60),
  ('01900023-0000-7000-8000-000000000003', 'NIGHT', '夜勤', '22:00', '07:00', 90);

INSERT INTO shift_assignments (id, employee_id, pattern_id, date, note, published_at) VALUES
  ('01900024-0000-7000-8000-000000000001', 5, '01900023-0000-7000-8000-000000000001', '2026-06-01', NULL, '2026-05-20T09:00:00Z'),
  ('01900024-0000-7000-8000-000000000002', 5, '01900023-0000-7000-8000-000000000002', '2026-06-02', '研修', NULL),
  ('01900024-0000-7000-8000-000000000003', 4, '01900023-0000-7000-8000-000000000001', '2026-06-01', NULL, '2026-05-20T09:00:00Z');

INSERT INTO shift_swap_requests (id, requester_employee_id, target_employee_id, date, note, status, approved_at) VALUES
  ('01900025-0000-7000-8000-000000000001', 5, 4, '2026-06-01', '通院のため', 'pending', NULL),
  ('01900025-0000-7000-8000-000000000002', 4, 5, '2026-06-03', NULL, 'approved', '2026-05-22T10:00:00Z');
