-- attendance ドメインの seed
-- 対象テーブル: attendance_records
-- migration: migrations/attendance.sql / 値: src/infrastructure/seed/seed-attendance-records.ts

INSERT INTO attendance_records (id, employee_id, work_date, clock_in_at, clock_out_at, work_minutes, overtime_minutes, status) VALUES
  (1, 5, '2026-05-25', '2026-05-25T09:00:00Z', '2026-05-25T18:00:00Z', 540, 60, 'closed'),
  (2, 5, '2026-05-26', '2026-05-26T09:00:00Z', '2026-05-26T17:30:00Z', 510, 30, 'closed'),
  (3, 9, '2026-05-25', '2026-05-25T10:00:00Z', '2026-05-25T18:00:00Z', 480, 0, 'closed'),
  (4, 9, '2026-05-29', '2026-05-29T09:15:00Z', NULL, NULL, NULL, 'open');
