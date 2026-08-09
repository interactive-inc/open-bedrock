-- System 通知の宛先を Company Employee から System Account へ移す。
-- 既存通知に対応 Account がない場合は失敗させ、通知の欠落を防ぐ。

CREATE TABLE notification_account_recipient_migration_guard (
  unlinked_count INTEGER NOT NULL CHECK (unlinked_count = 0)
);

INSERT INTO notification_account_recipient_migration_guard (unlinked_count)
SELECT COUNT(*)
FROM notifications notification
LEFT JOIN account_employee_links link
  ON link.employee_id = notification.recipient_employee_id
WHERE link.account_id IS NULL;

DROP TABLE notification_account_recipient_migration_guard;

CREATE TABLE notifications_with_account_recipient (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_account_id INTEGER NOT NULL,
  source_domain TEXT NOT NULL,
  source_id INTEGER,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

INSERT INTO notifications_with_account_recipient (
  id,
  recipient_account_id,
  source_domain,
  source_id,
  kind,
  title,
  body,
  is_read,
  created_at
)
SELECT
  notification.id,
  link.account_id,
  notification.source_domain,
  notification.source_id,
  notification.kind,
  notification.title,
  notification.body,
  notification.is_read,
  notification.created_at
FROM notifications notification
INNER JOIN account_employee_links link
  ON link.employee_id = notification.recipient_employee_id;

DROP TABLE notifications;
ALTER TABLE notifications_with_account_recipient RENAME TO notifications;

CREATE INDEX idx_notifications_recipient_unread
  ON notifications (recipient_account_id)
  WHERE is_read = 0;
