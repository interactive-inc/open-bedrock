-- legacy notificationsをcanonical System Message/Deliveryへ移し、旧tableを廃止する。
INSERT INTO system_notification_messages (
  id, kind, title, body, source_type, source_id, created_at
)
SELECT
  CAST(id AS TEXT),
  'company:' || kind,
  substr(title, 1, 200),
  CASE WHEN trim(coalesce(body, '')) = '' THEN NULL ELSE substr(body, 1, 10000) END,
  'company:notification.source',
  json_object('domain', source_domain, 'id', source_id),
  CAST(round((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
FROM notifications;

INSERT INTO system_notification_deliveries (
  id, message_id, recipient_account_id, delivered_at, read_at
)
SELECT
  CAST(id AS TEXT),
  CAST(id AS TEXT),
  CAST(recipient_account_id AS TEXT),
  CAST(round((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER),
  CASE
    WHEN is_read = 1
    THEN CAST(round((julianday(created_at) - 2440587.5) * 86400000) AS INTEGER)
    ELSE NULL
  END
FROM notifications;

SELECT CASE WHEN
  (SELECT count(*) FROM notifications) =
  (SELECT count(*) FROM system_notification_messages WHERE id GLOB '[0-9]*')
  AND (SELECT count(*) FROM notifications) =
  (SELECT count(*) FROM system_notification_deliveries WHERE id GLOB '[0-9]*')
THEN 1 ELSE json_extract('', '$') END AS canonical_notification_backfill_complete;

DROP TABLE notifications;
