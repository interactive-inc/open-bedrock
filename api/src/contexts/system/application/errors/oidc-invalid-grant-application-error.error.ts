import { ApplicationBadRequestError } from "@system/application/errors/application-bad-request-error.error"

export class OidcInvalidGrantApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super(
      { error: "invalid_grant", message: "The OIDC authorization grant is invalid." },
      { cause },
    )
  }
}
