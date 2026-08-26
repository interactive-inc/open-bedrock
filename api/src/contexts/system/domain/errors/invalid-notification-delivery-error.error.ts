import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidNotificationDeliveryReason } from "@system/domain/errors.shared"

export class InvalidNotificationDeliveryError extends DomainError {
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
