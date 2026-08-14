import type { NotificationRepository } from "@system/application/notifications/notification-repository"
import { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import { NotificationMessage } from "@system/domain/notifications/notification-message.entity"

type Props = Readonly<{
  notificationRepository: NotificationRepository
}>

export type PublishSystemNotificationCommand = Readonly<{
  message: NotificationMessage
  deliveries: NotificationDeliveryBatch
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
      !(command.message instanceof NotificationMessage) ||
      !(command.deliveries instanceof NotificationDeliveryBatch)
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
