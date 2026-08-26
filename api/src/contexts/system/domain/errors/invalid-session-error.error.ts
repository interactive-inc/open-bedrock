import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidSessionReason } from "@system/domain/errors.shared"

export class InvalidSessionError extends DomainError {
  readonly code = "invalid_session" as const

  constructor(
    readonly reason: InvalidSessionReason,
    cause?: unknown,
  ) {
    super("invalid_session", { cause })
    this.name = "InvalidSessionError"
    Object.freeze(this)
  }
}
