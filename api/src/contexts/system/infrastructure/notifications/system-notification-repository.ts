import type {
  MarkNotificationDeliveryReadProps,
  NotificationRepository,
} from "@system/application/notifications/notification-repository"
import type { AccountId } from "@system/domain/auth/account-id"
import type {
  NotificationDeliveryId,
  NotificationDelivery,
} from "@system/domain/notifications/notification-delivery.entity"
import type { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import type { NotificationMessage } from "@system/domain/notifications/notification-message.entity"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"
import { toSystemNotificationDelivery } from "@system/infrastructure/notifications/to-system-notification"

const maximumPublicationPayloadBytes = 1_000_000

type Props = Readonly<{
  context: SystemD1Context
}>

type DeliveryPayload = Readonly<{
  id: string
  messageId: string
  recipientAccountId: string
  deliveredAt: number
  readAt: number | null
}>

/** canonical MessageとAccount Deliveryだけを扱うportable D1 repository。 */
export class SystemNotificationRepository implements NotificationRepository {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async publish(
    message: NotificationMessage,
    deliveries: NotificationDeliveryBatch,
  ): Promise<void | Error> {
    const payload = toDeliveryPayload(deliveries)

    if (payload instanceof Error) return payload

    try {
      const database = this.props.context.env.DB
      const results = await database.batch([
        prepareMessageInsert(database, message),
        prepareDeliveryFanOut(database, message, payload),
        preparePublicationInvariant(database, message, payload),
      ])

      return results.length === 3 && results.every((result) => result.success)
        ? undefined
        : new Error("System Notification publication did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to publish System Notification")
    }
  }

  async findDeliveryByIdForAccount(
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
  ): Promise<NotificationDelivery | null | Error> {
    try {
      const row = await prepareDeliverySelect(
        this.props.context.env.DB,
        deliveryId,
        recipientAccountId,
      ).first<Record<string, unknown>>()

      return row === null ? null : toSystemNotificationDelivery(row)
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to find System Notification Delivery")
    }
  }

  async markDeliveryRead(
    props: MarkNotificationDeliveryReadProps,
  ): Promise<NotificationDelivery | null | Error> {
    try {
      const database = this.props.context.env.DB
      const results = await database.batch([
        database
          .prepare(
            `UPDATE system_notification_deliveries
             SET read_at = coalesce(read_at, ?1)
             WHERE id = ?2
               AND recipient_account_id = ?3
               AND delivered_at <= ?1
               AND (read_at IS NULL OR read_at <= ?1)`,
          )
          .bind(props.readAt.getTime(), props.deliveryId, props.recipientAccountId),
        prepareDeliverySelect(database, props.deliveryId, props.recipientAccountId),
      ])

      if (results.length !== 2 || results.some((result) => !result.success)) {
        return new Error("System Notification read transition did not succeed")
      }

      const rows = results[1]?.results
      if (!Array.isArray(rows) || rows.length > 1) {
        return new Error("System Notification Delivery result is invalid")
      }
      if (rows.length === 0) return null

      const delivery = toSystemNotificationDelivery(rows[0])
      if (delivery instanceof Error) return delivery

      const transition = delivery.markRead(props.readAt)
      if (transition instanceof Error) return transition
      if (!delivery.isRead) {
        return new Error("System Notification read transition was not persisted")
      }

      return delivery
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to mark System Notification Delivery read")
    }
  }
}

function toDeliveryPayload(deliveries: NotificationDeliveryBatch): string | Error {
  const values: Array<DeliveryPayload> = deliveries.deliveries.map((delivery) => ({
    id: delivery.id,
    messageId: delivery.messageId,
    recipientAccountId: delivery.recipientAccountId,
    deliveredAt: delivery.deliveredAt.getTime(),
    readAt: delivery.readAt?.getTime() ?? null,
  }))
  const payload = JSON.stringify(values)

  return new TextEncoder().encode(payload).byteLength <= maximumPublicationPayloadBytes
    ? payload
    : new Error("System Notification publication payload is too large")
}

function prepareMessageInsert(
  database: D1Database,
  message: NotificationMessage,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO system_notification_messages
         (id, kind, title, body, source_type, source_id, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      message.id,
      message.kind,
      message.title,
      message.body,
      message.source?.type ?? null,
      message.source?.id ?? null,
      message.createdAt.getTime(),
    )
}

function prepareDeliveryFanOut(
  database: D1Database,
  message: NotificationMessage,
  payload: string,
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO system_notification_deliveries
         (id, message_id, recipient_account_id, delivered_at, read_at)
       SELECT
         json_extract(item.value, '$.id'),
         json_extract(item.value, '$.messageId'),
         json_extract(item.value, '$.recipientAccountId'),
         json_extract(item.value, '$.deliveredAt'),
         NULL
       FROM json_each(?1) AS item
       INNER JOIN system_accounts AS account
         ON account.id = json_extract(item.value, '$.recipientAccountId')
        AND account.status = 'active'
       WHERE json_extract(item.value, '$.messageId') = ?2
         AND json_extract(item.value, '$.deliveredAt') >= ?3
         AND json_extract(item.value, '$.readAt') IS NULL`,
    )
    .bind(payload, message.id, message.createdAt.getTime())
}

function preparePublicationInvariant(
  database: D1Database,
  message: NotificationMessage,
  payload: string,
): D1PreparedStatement {
  return database
    .prepare(
      `SELECT CASE WHEN
         json_array_length(?1) > 0
         AND EXISTS (
           SELECT 1 FROM system_notification_messages
           WHERE id = ?2 AND kind = ?3 AND title = ?4 AND body IS ?5
             AND source_type IS ?6 AND source_id IS ?7 AND created_at = ?8
         )
         AND NOT EXISTS (
           SELECT 1
           FROM json_each(?1) AS item
           LEFT JOIN system_notification_deliveries AS delivery
             ON delivery.id = json_extract(item.value, '$.id')
            AND delivery.message_id = json_extract(item.value, '$.messageId')
            AND delivery.recipient_account_id = json_extract(item.value, '$.recipientAccountId')
            AND delivery.delivered_at = json_extract(item.value, '$.deliveredAt')
            AND delivery.read_at IS NULL
           WHERE delivery.id IS NULL
         )
       THEN 1 ELSE json_extract('', '$') END AS ok`,
    )
    .bind(
      payload,
      message.id,
      message.kind,
      message.title,
      message.body,
      message.source?.type ?? null,
      message.source?.id ?? null,
      message.createdAt.getTime(),
    )
}

function prepareDeliverySelect(
  database: D1Database,
  deliveryId: NotificationDeliveryId,
  recipientAccountId: AccountId,
): D1PreparedStatement {
  return database
    .prepare(
      `SELECT id, message_id, recipient_account_id, delivered_at, read_at
       FROM system_notification_deliveries
       WHERE id = ?1 AND recipient_account_id = ?2
       LIMIT 1`,
    )
    .bind(deliveryId, recipientAccountId)
}
