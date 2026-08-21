import { NotificationDeliveryBatchValue } from "@system/domain/values/notifications/notification-delivery-batch.value"
import { NotificationMessageEntity } from "@system/domain/entities/notification-message.entity"
import type { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification.repository"

type Props = Readonly<{
  notificationRepository: Pick<SystemNotificationRepository, "publish">
}>

export type PublishSystemNotificationCommand = Readonly<{
  message: NotificationMessageEntity
  deliveries: NotificationDeliveryBatchValue
}>

export type PublishSystemNotificationRejection =
  | "already_read"
  | "delivery_before_message"
  | "empty_deliveries"
  | "invalid_shape"
  | "message_mismatch"

export type PublishSystemNotificationResult =
  | Readonly<{ kind: "published" }>
  | Readonly<{ kind: "rejected"; reason: PublishSystemNotificationRejection }>

/** immutable Messageを具体的なAccount Deliveryへ不可分にfan-outする。 */
export class PublishSystemNotification {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(
    command: PublishSystemNotificationCommand,
  ): Promise<PublishSystemNotificationResult | Error> {
    if (
      !(command.message instanceof NotificationMessageEntity) ||
      !(command.deliveries instanceof NotificationDeliveryBatchValue)
    ) {
      return rejected("invalid_shape")
    }
    if (command.deliveries.deliveries.length === 0) return rejected("empty_deliveries")

    const messageCreatedAt = command.message.createdAt.getTime()

    for (const delivery of command.deliveries.deliveries) {
      if (delivery.messageId !== command.message.id) return rejected("message_mismatch")
      if (delivery.isRead) return rejected("already_read")
      if (delivery.deliveredAt.getTime() < messageCreatedAt) {
        return rejected("delivery_before_message")
      }
    }

    const publicationError = await this.props.notificationRepository.publish(
      command.message,
      command.deliveries,
    )
    if (publicationError instanceof Error) return publicationError

    return Object.freeze({ kind: "published" as const })
  }
}

function rejected(reason: PublishSystemNotificationRejection): PublishSystemNotificationResult {
  return Object.freeze({ kind: "rejected" as const, reason })
}
