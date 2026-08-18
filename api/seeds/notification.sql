-- notification ドメインの seed
-- 対象テーブル: system_notification_messages / system_notification_deliveries
-- 宛先の System Account id は iam.sql と揃える。
-- 値: src/infrastructure/seed/seed-notifications.ts

INSERT INTO system_notification_messages
  (id, kind, title, body, source_type, source_id, created_at)
VALUES
  ('1', 'company:approval_request', '承認待ち', 'このリクエストを確認してください。', 'company:notification.source', '{"domain":"application","id":10}', 1779267600000),
  ('2', 'company:announcement', '既読のお知らせ', NULL, 'company:notification.source', '{"domain":"manual","id":null}', 1779440400000),
  ('3', 'company:reminder', 'リマインダー', NULL, 'company:notification.source', '{"domain":"reminder","id":null}', 1779699600000),
  ('4', 'company:task', '他のアカウントへの通知', NULL, 'company:notification.source', '{"domain":"manual","id":null}', 1779786000000);

INSERT INTO system_notification_deliveries
  (id, message_id, recipient_account_id, delivered_at, read_at)
VALUES
  ('1', '1', '5', 1779267600000, NULL),
  ('2', '2', '5', 1779440400000, 1779440400000),
  ('3', '3', '5', 1779699600000, NULL),
  ('4', '4', '9', 1779786000000, NULL);
