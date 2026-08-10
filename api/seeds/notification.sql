-- notification ドメインの seed
-- 対象テーブル: notifications
-- 0124 で宛先が recipient_account_id（System Account）になった。account id は iam.sql と揃える。
-- 値: src/infrastructure/seed/seed-notifications.ts

INSERT INTO notifications (id, recipient_account_id, source_domain, source_id, kind, title, body, is_read, created_at) VALUES
  (1, 5, 'application', 10, 'approval_request', '承認待ち', 'このリクエストを確認してください。', 0, '2026-05-20T09:00:00Z'),
  (2, 5, 'manual', NULL, 'announcement', '既読のお知らせ', NULL, 1, '2026-05-22T09:00:00Z'),
  (3, 5, 'reminder', NULL, 'reminder', 'リマインダー', NULL, 0, '2026-05-25T09:00:00Z'),
  (4, 9, 'manual', NULL, 'task', '他のアカウントへの通知', NULL, 0, '2026-05-26T09:00:00Z');
