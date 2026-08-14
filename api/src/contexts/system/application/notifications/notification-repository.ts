import type { AccountId } from "@system/domain/auth/account-id"
import type {
  NotificationDeliveryId,
  NotificationDelivery,
} from "@system/domain/notifications/notification-delivery.entity"
import type { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import type { NotificationMessage } from "@system/domain/notifications/notification-message.entity"

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
  markDeliveryRead: (
    props: MarkNotificationDeliveryReadProps,
  ) => Promise<NotificationDelivery | null | Error>
}>
