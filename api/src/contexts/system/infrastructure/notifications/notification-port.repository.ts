import type { AccountId } from "@system/domain/auth/account-id"
import type {
  NotificationDeliveryId,
  NotificationDelivery,
} from "@system/domain/notifications/notification-delivery.entity"
import type { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import type { NotificationMessage } from "@system/domain/notifications/notification-message.entity"

export type SystemNotification = Readonly<{
  delivery: NotificationDelivery
  message: NotificationMessage
}>

export type SystemNotificationPage = Readonly<{
  items: ReadonlyArray<SystemNotification>
  total: number
}>

export type ListSystemNotificationsProps = Readonly<{
  recipientAccountId: AccountId
  read: boolean | null
  limit: number
  offset: number
}>

export type MarkNotificationDeliveryReadProps = Readonly<{
  deliveryId: NotificationDeliveryId
  recipientAccountId: AccountId
  readAt: Date
}>

/** canonical Notification MessageとAccount Deliveryを永続化するApplication port。 */
export type NotificationRepository = Readonly<{
  publish: (
    message: NotificationMessage,
    deliveries: NotificationDeliveryBatch,
  ) => Promise<void | Error>
  findDeliveryByIdForAccount: (
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
  ) => Promise<NotificationDelivery | null | Error>
  findByDeliveryIdForAccount: (
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
  ) => Promise<SystemNotification | null | Error>
  listForAccount: (props: ListSystemNotificationsProps) => Promise<SystemNotificationPage | Error>
  countUnreadForAccount: (recipientAccountId: AccountId) => Promise<number | Error>
  markDeliveryRead: (
    props: MarkNotificationDeliveryReadProps,
  ) => Promise<NotificationDelivery | null | Error>
  markAllDeliveriesRead: (recipientAccountId: AccountId, readAt: Date) => Promise<number | Error>
  dismissDelivery: (
    deliveryId: NotificationDeliveryId,
    recipientAccountId: AccountId,
  ) => Promise<boolean | Error>
}>
