import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidSystemPasswordReason } from "@system/domain/errors.shared"

export class InvalidSystemPasswordError extends DomainError {
  readonly code = "invalid_system_password" as const

  constructor(readonly reason: InvalidSystemPasswordReason) {
    super(reason)
    this.name = "InvalidSystemPasswordError"
    Object.freeze(this)
  }
}
