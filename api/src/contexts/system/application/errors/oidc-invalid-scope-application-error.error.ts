import { ApplicationBadRequestError } from "@system/application/errors/application-bad-request-error.error"

export class OidcInvalidScopeApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super({ error: "invalid_scope", message: "The requested OIDC scope is invalid." }, { cause })
  }
}
