import { NotificationDelivery } from "@system/domain/notifications/notification-delivery.entity"
import { NotificationMessage } from "@system/domain/notifications/notification-message.entity"

/** untrustedなD1 rowをcanonical Notification Messageへfail closedに変換する。 */
export function toSystemNotificationMessage(row: unknown): NotificationMessage | Error {
  if (!isRecord(row)) return new Error("System Notification Message row is invalid")

  return NotificationMessage.create({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    source:
      row.source_type === null && row.source_id === null
        ? null
        : { type: row.source_type, id: row.source_id },
    createdAt: toDate(row.created_at),
  })
}

/** untrustedなD1 rowをcanonical Notification Deliveryへfail closedに変換する。 */
export function toSystemNotificationDelivery(row: unknown): NotificationDelivery | Error {
  if (!isRecord(row)) return new Error("System Notification Delivery row is invalid")

  return NotificationDelivery.create({
    id: row.id,
    messageId: row.message_id,
    recipientAccountId: row.recipient_account_id,
    deliveredAt: toDate(row.delivered_at),
    readAt: row.read_at === null ? null : toDate(row.read_at),
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toDate(value: unknown): unknown {
  return typeof value === "number" ? new Date(value) : value
}
