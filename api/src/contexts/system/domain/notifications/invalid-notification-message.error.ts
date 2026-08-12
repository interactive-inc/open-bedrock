export const invalidNotificationMessageReasons = Object.freeze(["invalid_shape"] as const)

export type InvalidNotificationMessageReason = (typeof invalidNotificationMessageReasons)[number]

export class InvalidNotificationMessageError extends Error {
  readonly code = "invalid_notification_message" as const

  constructor(
    readonly reason: InvalidNotificationMessageReason,
    cause?: unknown,
  ) {
    super("invalid_notification_message", { cause })
    this.name = "InvalidNotificationMessageError"
    Object.freeze(this)
  }
}
