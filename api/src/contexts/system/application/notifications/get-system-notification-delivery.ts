import type { NotificationRepository } from "@system/application/notifications/notification-repository"
import type { AccountId } from "@system/domain/auth/account-id"
import type {
  NotificationDeliveryId,
  NotificationDelivery,
} from "@system/domain/notifications/notification-delivery.entity"

type Props = Readonly<{
  notificationRepository: NotificationRepository
}>

export type GetSystemNotificationDeliveryCommand = Readonly<{
  deliveryId: NotificationDeliveryId
  recipientAccountId: AccountId
}>

export type GetSystemNotificationDeliveryResult =
  | Readonly<{ kind: "found"; delivery: NotificationDelivery }>
  | Readonly<{ kind: "not_found" }>

/** Delivery IDと受信Accountの組を必須にして他Accountのreceiptを隠す。 */
export class GetSystemNotificationDelivery {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(
    command: GetSystemNotificationDeliveryCommand,
  ): Promise<GetSystemNotificationDeliveryResult | Error> {
    const delivery = await this.props.notificationRepository.findDeliveryByIdForAccount(
      command.deliveryId,
      command.recipientAccountId,
    )

    if (delivery instanceof Error) return delivery
    if (delivery === null) return Object.freeze({ kind: "not_found" as const })

    return Object.freeze({ kind: "found" as const, delivery })
  }
}
