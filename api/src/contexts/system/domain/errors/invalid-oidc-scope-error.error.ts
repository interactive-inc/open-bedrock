import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidOidcScopeReason } from "@system/domain/errors.shared"

export class InvalidOidcScopeError extends DomainError {
  readonly code = "invalid_oidc_scope" as const

  constructor(readonly reason: InvalidOidcScopeReason) {
    super(reason)
    this.name = "InvalidOidcScopeError"
    Object.freeze(this)
  }
}
