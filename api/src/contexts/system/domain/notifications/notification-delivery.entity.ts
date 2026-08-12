import { zAccountId, type AccountId } from "@system/domain/auth/account-id"
import { InvalidNotificationDeliveryError } from "@system/domain/notifications/invalid-notification-delivery.error"
import {
  notificationMessageIdSchema,
  type NotificationMessageId,
} from "@system/domain/notifications/notification-message.entity"
import { z } from "zod"

export const notificationDeliveryIdSchema = z
  .string()
  .min(1)
  .max(255)
  .brand<"NotificationDeliveryId">()

export type NotificationDeliveryId = z.infer<typeof notificationDeliveryIdSchema>

const propsSchema = z
  .object({
    id: notificationDeliveryIdSchema,
    messageId: notificationMessageIdSchema,
    recipientAccountId: zAccountId,
    deliveredAt: z.date(),
    readAt: z.date().nullable(),
  })
  .strict()

type ParsedProps = z.output<typeof propsSchema>

/** concreteなAccount宛ての配信と単調な既読状態だけを所有するSystem receipt。 */
export class NotificationDelivery {
  readonly id: NotificationDeliveryId
  readonly messageId: NotificationMessageId
  readonly recipientAccountId: AccountId
  readonly #deliveredAtEpochMilliseconds: number
  readonly #readAtEpochMilliseconds: number | null

  private constructor(props: ParsedProps) {
    this.id = props.id
    this.messageId = props.messageId
    this.recipientAccountId = props.recipientAccountId
    this.#deliveredAtEpochMilliseconds = props.deliveredAt.getTime()
    this.#readAtEpochMilliseconds = props.readAt?.getTime() ?? null
    Object.freeze(this)
  }

  static create(input: unknown): NotificationDelivery | InvalidNotificationDeliveryError {
    const parsed = propsSchema.safeParse(input)

    if (!parsed.success) {
      return new InvalidNotificationDeliveryError("invalid_shape", parsed.error)
    }
    if (
      parsed.data.readAt !== null &&
      parsed.data.readAt.getTime() < parsed.data.deliveredAt.getTime()
    ) {
      return new InvalidNotificationDeliveryError("read_before_delivery")
    }

    return new NotificationDelivery(parsed.data)
  }

  get deliveredAt(): Date {
    return new Date(this.#deliveredAtEpochMilliseconds)
  }

  get readAt(): Date | null {
    return this.#readAtEpochMilliseconds === null ? null : new Date(this.#readAtEpochMilliseconds)
  }

  get isRead(): boolean {
    return this.#readAtEpochMilliseconds !== null
  }

  markRead(at: unknown): NotificationDelivery | InvalidNotificationDeliveryError {
    const parsedAt = z.date().safeParse(at)

    if (!parsedAt.success) {
      return new InvalidNotificationDeliveryError("invalid_shape", parsedAt.error)
    }

    const atEpochMilliseconds = parsedAt.data.getTime()

    if (
      this.#readAtEpochMilliseconds !== null &&
      atEpochMilliseconds < this.#readAtEpochMilliseconds
    ) {
      return new InvalidNotificationDeliveryError("transition_before_last_update")
    }
    if (this.#readAtEpochMilliseconds !== null) return this

    return NotificationDelivery.create({ ...this.toProps(), readAt: parsedAt.data })
  }

  private toProps(): ParsedProps {
    return {
      id: this.id,
      messageId: this.messageId,
      recipientAccountId: this.recipientAccountId,
      deliveredAt: this.deliveredAt,
      readAt: this.readAt,
    }
  }
}
