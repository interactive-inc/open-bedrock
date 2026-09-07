-- attendance ドメインの seed
-- 対象テーブル: attendance_records
-- migration: migrations/attendance.sql / 値: src/infrastructure/seed/seed-attendance-records.ts

INSERT INTO attendance_records (id, employee_id, work_date, clock_in_at, clock_out_at, work_minutes, status) VALUES
  ('01900015-0000-7000-8000-000000000001', 5, '2026-05-25', '2026-05-25T09:00:00Z', '2026-05-25T18:00:00Z', 540, 'closed'),
  ('01900015-0000-7000-8000-000000000002', 5, '2026-05-26', '2026-05-26T09:00:00Z', '2026-05-26T17:30:00Z', 510, 'closed'),
  ('01900015-0000-7000-8000-000000000003', 9, '2026-05-25', '2026-05-25T10:00:00Z', '2026-05-25T18:00:00Z', 480, 'closed'),
  ('01900015-0000-7000-8000-000000000004', 9, '2026-05-29', '2026-05-29T09:15:00Z', NULL, NULL, 'open');
