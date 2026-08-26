import { ApplicationBadRequestError } from "@system/application/errors/application-bad-request-error.error"

export class OidcInvalidRequestApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super({ error: "invalid_request", message: "The OIDC request is invalid." }, { cause })
  }
}
