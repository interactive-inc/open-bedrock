import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidAccountReason } from "@system/domain/errors.shared"

export class InvalidAccountError extends DomainError {
  readonly code = "invalid_account" as const

  constructor(
    readonly reason: InvalidAccountReason,
    cause?: unknown,
  ) {
    super("invalid_account", { cause })
    this.name = "InvalidAccountError"
    Object.freeze(this)
  }
}
