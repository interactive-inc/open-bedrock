import { DomainError } from "@system/domain/errors/domain-error.error"

export class InvalidOidcClientRegistryError extends DomainError {
  readonly code = "invalid_oidc_client_registry"

  constructor() {
    super("OIDC client registry is not canonical")
    this.name = "InvalidOidcClientRegistryError"
  }
}
