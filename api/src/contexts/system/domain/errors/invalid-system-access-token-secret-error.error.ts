import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidSystemAccessTokenSecretReason } from "@system/domain/errors.shared"

export class InvalidSystemAccessTokenSecretError extends DomainError {
  readonly code = "invalid_system_access_token_secret" as const

  constructor(readonly reason: InvalidSystemAccessTokenSecretReason) {
    super(reason)
    this.name = "InvalidSystemAccessTokenSecretError"
    Object.freeze(this)
  }
}
