import type { NotificationRepository } from "@system/application/notifications/notification-repository"
import type { AccountId } from "@system/domain/auth/account-id"
import {
  InvalidNotificationDeliveryError,
  type InvalidNotificationDeliveryReason,
} from "@system/domain/notifications/invalid-notification-delivery.error"
import type {
  NotificationDeliveryId,
  NotificationDelivery,
} from "@system/domain/notifications/notification-delivery.entity"

type Props = Readonly<{
  notificationRepository: NotificationRepository
}>

export type MarkSystemNotificationReadCommand = Readonly<{
  deliveryId: NotificationDeliveryId
  recipientAccountId: AccountId
  readAt: Date
}>

export type MarkSystemNotificationReadResult =
  | Readonly<{ kind: "marked"; delivery: NotificationDelivery }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "rejected"; reason: InvalidNotificationDeliveryReason }>

/** Account所有境界を保ったままread receiptを単調に更新する。 */
export class MarkSystemNotificationRead {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(
    command: MarkSystemNotificationReadCommand,
  ): Promise<MarkSystemNotificationReadResult | Error> {
    if (!(command.readAt instanceof Date) || !Number.isFinite(command.readAt.getTime())) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_shape" as const })
    }

    const delivery = await this.props.notificationRepository.markDeliveryRead(command)

    if (delivery instanceof InvalidNotificationDeliveryError) {
      return Object.freeze({ kind: "rejected" as const, reason: delivery.reason })
    }
    if (delivery instanceof Error) return delivery
    if (delivery === null) return Object.freeze({ kind: "not_found" as const })

    return Object.freeze({ kind: "marked" as const, delivery })
  }
}
