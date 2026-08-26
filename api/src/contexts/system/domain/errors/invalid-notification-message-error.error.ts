import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidNotificationMessageReason } from "@system/domain/errors.shared"

export class InvalidNotificationMessageError extends DomainError {
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
