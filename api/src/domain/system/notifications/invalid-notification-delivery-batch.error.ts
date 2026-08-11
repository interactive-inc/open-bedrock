export const invalidNotificationDeliveryBatchReasons = Object.freeze([
  "duplicate_delivery_id",
  "duplicate_message_recipient",
  "invalid_shape",
] as const)

export type InvalidNotificationDeliveryBatchReason =
  (typeof invalidNotificationDeliveryBatchReasons)[number]

export class InvalidNotificationDeliveryBatchError extends Error {
  readonly code = "invalid_notification_delivery_batch" as const

  constructor(
    readonly reason: InvalidNotificationDeliveryBatchReason,
    cause?: unknown,
  ) {
    super("invalid_notification_delivery_batch", { cause })
    this.name = "InvalidNotificationDeliveryBatchError"
    Object.freeze(this)
  }
}
