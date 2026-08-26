import { DomainError } from "@system/domain/errors/domain-error.error"

export class InvalidOidcIssuerError extends DomainError {
  readonly code = "invalid_oidc_issuer" as const

  constructor() {
    super("unknown_oidc_issuer")
    this.name = "InvalidOidcIssuerError"
    Object.freeze(this)
  }
}
