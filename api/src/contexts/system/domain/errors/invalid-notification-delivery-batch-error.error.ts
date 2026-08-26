import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidNotificationDeliveryBatchReason } from "@system/domain/errors.shared"

export class InvalidNotificationDeliveryBatchError extends DomainError {
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
