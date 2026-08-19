import type {
  ListSystemNotificationsProps,
  MarkNotificationDeliveryReadProps,
  NotificationRepository,
  SystemNotification,
  SystemNotificationPage,
} from "@system/application/notifications/notification-repository"
import type { AccountId } from "@system/domain/auth/account-id"
import type {
  NotificationDeliveryId,
  NotificationDelivery,
} from "@system/domain/notifications/notification-delivery.entity"
import type { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import type { NotificationMessage } from "@system/domain/notifications/notification-message.entity"
import type { SystemD1Context } from "@system/infrastructure/configuration/system-context"
import { toSystemNotificationDelivery } from "@system/infrastructure/notifications/to-system-notification-delivery"
import { toSystemNotificationMessage } from "@system/infrastructure/notifications/to-system-notification-message"

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

  async findByDeliveryIdForAccount(
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
  ): Promise<SystemNotification | null | Error> {
    try {
      const row = await prepareNotificationSelect(
        this.props.context.env.DB,
        deliveryId,
        recipientAccountId,
      ).first<Record<string, unknown>>()

      return row === null ? null : toSystemNotification(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find System Notification")
    }
  }

  async listForAccount(
    props: ListSystemNotificationsProps,
  ): Promise<SystemNotificationPage | Error> {
    try {
      const database = this.props.context.env.DB
      const results = await database.batch([
        database
          .prepare(
            `SELECT
               delivery.id AS delivery_id,
               delivery.message_id,
               delivery.recipient_account_id,
               delivery.delivered_at,
               delivery.read_at,
               message.id AS message_id_value,
               message.kind,
               message.title,
               message.body,
               message.source_type,
               message.source_id,
               message.created_at
             FROM system_notification_deliveries AS delivery
             INNER JOIN system_notification_messages AS message ON message.id = delivery.message_id
             WHERE delivery.recipient_account_id = ?1
               AND (?2 IS NULL OR (delivery.read_at IS NOT NULL) = ?2)
             ORDER BY delivery.delivered_at DESC, delivery.id DESC
             LIMIT ?3 OFFSET ?4`,
          )
          .bind(
            props.recipientAccountId,
            props.read === null ? null : props.read ? 1 : 0,
            props.limit,
            props.offset,
          ),
        database
          .prepare(
            `SELECT count(*) AS total
             FROM system_notification_deliveries
             WHERE recipient_account_id = ?1
               AND (?2 IS NULL OR (read_at IS NOT NULL) = ?2)`,
          )
          .bind(props.recipientAccountId, props.read === null ? null : props.read ? 1 : 0),
      ])

      if (results.length !== 2 || results.some((result) => !result.success)) {
        return new Error("System Notification list did not succeed")
      }

      const items: Array<SystemNotification> = []
      for (const row of results[0]?.results ?? []) {
        const notification = toSystemNotification(row)
        if (notification instanceof Error) return notification
        items.push(notification)
      }

      const total = (results[1]?.results?.[0] as Record<string, unknown> | undefined)?.total
      if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
        return new Error("System Notification total is invalid")
      }

      return Object.freeze({ items: Object.freeze(items), total })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to list System Notifications")
    }
  }

  async countUnreadForAccount(recipientAccountId: AccountId): Promise<number | Error> {
    try {
      const total = await this.props.context.env.DB.prepare(
        `SELECT count(*) AS total
           FROM system_notification_deliveries
           WHERE recipient_account_id = ?1 AND read_at IS NULL`,
      )
        .bind(recipientAccountId)
        .first<number>("total")

      return typeof total === "number" && Number.isSafeInteger(total) && total >= 0
        ? total
        : new Error("System Notification unread count is invalid")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to count unread System Notifications")
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

  async markAllDeliveriesRead(
    recipientAccountId: AccountId,
    readAt: Date,
  ): Promise<number | Error> {
    try {
      const result = await this.props.context.env.DB.prepare(
        `UPDATE system_notification_deliveries
           SET read_at = ?1
           WHERE recipient_account_id = ?2
             AND read_at IS NULL
             AND delivered_at <= ?1`,
      )
        .bind(readAt.getTime(), recipientAccountId)
        .run()

      const changes = result.meta.changes
      return Number.isSafeInteger(changes) && changes >= 0
        ? changes
        : new Error("System Notification read-all count is invalid")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to mark all System Notifications read")
    }
  }

  async dismissDelivery(
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
  ): Promise<boolean | Error> {
    try {
      const result = await this.props.context.env.DB.prepare(
        `DELETE FROM system_notification_deliveries
           WHERE id = ?1 AND recipient_account_id = ?2`,
      )
        .bind(deliveryId, recipientAccountId)
        .run()

      return result.meta.changes === 1
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to dismiss System Notification")
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

function prepareNotificationSelect(
  database: D1Database,
  deliveryId: NotificationDeliveryId,
  recipientAccountId: AccountId,
): D1PreparedStatement {
  return database
    .prepare(
      `SELECT
         delivery.id AS delivery_id,
         delivery.message_id,
         delivery.recipient_account_id,
         delivery.delivered_at,
         delivery.read_at,
         message.id AS message_id_value,
         message.kind,
         message.title,
         message.body,
         message.source_type,
         message.source_id,
         message.created_at
       FROM system_notification_deliveries AS delivery
       INNER JOIN system_notification_messages AS message ON message.id = delivery.message_id
       WHERE delivery.id = ?1 AND delivery.recipient_account_id = ?2
       LIMIT 1`,
    )
    .bind(deliveryId, recipientAccountId)
}

function toSystemNotification(row: unknown): SystemNotification | Error {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return new Error("System Notification row is invalid")
  }

  const values = row as Record<string, unknown>
  const delivery = toSystemNotificationDelivery({
    id: values.delivery_id,
    message_id: values.message_id,
    recipient_account_id: values.recipient_account_id,
    delivered_at: values.delivered_at,
    read_at: values.read_at,
  })
  if (delivery instanceof Error) return delivery

  const message = toSystemNotificationMessage({
    id: values.message_id_value,
    kind: values.kind,
    title: values.title,
    body: values.body,
    source_type: values.source_type,
    source_id: values.source_id,
    created_at: values.created_at,
  })
  if (message instanceof Error) return message
  if (message.id !== delivery.messageId) {
    return new Error("System Notification Message and Delivery do not match")
  }

  return Object.freeze({ message, delivery })
}
