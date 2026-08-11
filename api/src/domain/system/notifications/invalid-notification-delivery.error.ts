export const invalidNotificationDeliveryReasons = Object.freeze([
  "invalid_shape",
  "read_before_delivery",
  "transition_before_last_update",
] as const)

export type InvalidNotificationDeliveryReason = (typeof invalidNotificationDeliveryReasons)[number]

export class InvalidNotificationDeliveryError extends Error {
  readonly code = "invalid_notification_delivery" as const

  constructor(
    readonly reason: InvalidNotificationDeliveryReason,
    cause?: unknown,
  ) {
    super("invalid_notification_delivery", { cause })
    this.name = "InvalidNotificationDeliveryError"
    Object.freeze(this)
  }
}
