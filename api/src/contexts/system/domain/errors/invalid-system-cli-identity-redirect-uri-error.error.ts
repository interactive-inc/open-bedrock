import { DomainError } from "@system/domain/errors/domain-error.error"

export class InvalidSystemCliIdentityRedirectUriError extends DomainError {
  readonly code = "invalid_system_cli_identity_redirect_uri" as const

  constructor() {
    super("invalid_system_cli_identity_redirect_uri")
    this.name = "InvalidSystemCliIdentityRedirectUriError"
    Object.freeze(this)
  }
}
