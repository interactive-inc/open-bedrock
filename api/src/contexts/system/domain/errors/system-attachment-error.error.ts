import { DomainError } from "@system/domain/errors/domain-error.error"
import type { SystemAttachmentErrorKind } from "@system/domain/errors.shared"

export class SystemAttachmentError extends DomainError {
  constructor(
    readonly kind: SystemAttachmentErrorKind,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "SystemAttachmentError"
    Object.freeze(this)
  }
}
