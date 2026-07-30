-- leave ドメインの seed
-- 対象テーブル: leave_requests / leave_balances
-- migration: migrations/leave.sql / 値: src/infrastructure/seed/seed-leave-requests.ts, seed-leave-balances.ts

INSERT INTO leave_requests (id, employee_id, leave_type, start_date, end_date, days, unit, hours, consumed_days, reason, status, approver_id, decided_comment, created_at) VALUES
  (1, 5, 'annual', '2026-06-01', '2026-06-03', 3, 'full_day', NULL, 3, '私用のため', 'pending', NULL, NULL, '2026-05-20T00:00:00Z'),
  (2, 10, 'special', '2026-07-10', '2026-07-10', 1, 'full_day', NULL, 1, NULL, 'approved', 4, '承認しました', '2026-05-21T00:00:00Z'),
  (3, 5, 'compensatory', '2026-06-15', '2026-06-15', 1, 'full_day', NULL, 1, '休日出勤の代休', 'pending', NULL, NULL, '2026-05-22T00:00:00Z'),
  (4, 5, 'annual', '2026-06-20', '2026-06-20', 1, 'hourly', 2, 0.25, '通院のため', 'pending', NULL, NULL, '2026-05-23T00:00:00Z');

INSERT INTO leave_balances (employee_id, fiscal_year, leave_type, granted_days, used_days, remaining_days) VALUES
  (5, '2026', 'annual', 20, 5, 15),
  (5, '2026', 'special', 5, 0, 5),
  (5, '2026', 'summer', 3, 0, 3),
  (5, '2026', 'child_nursing_care', 5, 0, 5),
  (5, '2026', 'caregiving_leave', 5, 0, 5),
  (10, '2026', 'annual', 18, 2, 16),
  (10, '2026', 'special', 5, 1, 4),
  (10, '2026', 'summer', 3, 0, 3),
  (10, '2026', 'child_nursing_care', 5, 0, 5),
  (10, '2026', 'caregiving_leave', 5, 0, 5);
