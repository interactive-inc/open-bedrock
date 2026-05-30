-- shift ドメインの seed
-- 対象テーブル: shift_patterns / shift_assignments / shift_swap_requests
-- migration: migrations/shift.sql / 値: src/infrastructure/seed/seed-shift-patterns.ts, seed-shift-assignments.ts, seed-shift-swap-requests.ts

INSERT INTO shift_patterns (id, code, name, start_time, end_time, break_minutes) VALUES
  (1, 'EARLY', 'Early', '07:00', '16:00', 60),
  (2, 'LATE', 'Late', '13:00', '22:00', 60),
  (3, 'NIGHT', 'Night', '22:00', '07:00', 90);

INSERT INTO shift_assignments (id, employee_id, pattern_id, date, note, published_at) VALUES
  (1, 5, 1, '2026-06-01', NULL, '2026-05-20T09:00:00Z'),
  (2, 5, 2, '2026-06-02', 'Training', NULL),
  (3, 4, 1, '2026-06-01', NULL, '2026-05-20T09:00:00Z');

INSERT INTO shift_swap_requests (id, requester_employee_id, target_employee_id, date, note, status, approved_at) VALUES
  (1, 5, 4, '2026-06-01', 'Medical appointment', 'pending', NULL),
  (2, 4, 5, '2026-06-03', NULL, 'approved', '2026-05-22T10:00:00Z');
