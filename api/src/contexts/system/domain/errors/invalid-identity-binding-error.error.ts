import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidIdentityBindingReason } from "@system/domain/errors.shared"

export class InvalidIdentityBindingError extends DomainError {
  readonly code = "invalid_identity_binding" as const

  constructor(
    readonly reason: InvalidIdentityBindingReason,
    cause?: unknown,
  ) {
    super("invalid_identity_binding", { cause })
    this.name = "InvalidIdentityBindingError"
    Object.freeze(this)
  }
}
