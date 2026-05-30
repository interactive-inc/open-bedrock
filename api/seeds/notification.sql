-- notification ドメインの seed
-- 対象テーブル: notifications
-- migration: migrations/notification.sql / 値: src/infrastructure/seed/seed-notifications.ts

INSERT INTO notifications (id, recipient_employee_id, source_domain, source_id, kind, title, body, is_read, created_at) VALUES
  (1, 5, 'application', 10, 'approval_request', 'Approval pending', 'Please review this request.', 0, '2026-05-20T09:00:00Z'),
  (2, 5, 'manual', NULL, 'announcement', 'Read announcement', NULL, 1, '2026-05-22T09:00:00Z'),
  (3, 5, 'reminder', NULL, 'reminder', 'Reminder', NULL, 0, '2026-05-25T09:00:00Z'),
  (4, 6, 'manual', NULL, 'task', 'Another employee notification', NULL, 0, '2026-05-26T09:00:00Z');
