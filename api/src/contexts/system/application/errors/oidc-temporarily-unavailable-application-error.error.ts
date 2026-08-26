import { ApplicationServiceUnavailableError } from "@system/application/errors/application-service-unavailable-error.error"

export class OidcTemporarilyUnavailableApplicationError extends ApplicationServiceUnavailableError {
  constructor(cause?: unknown) {
    super(
      {
        error: "temporarily_unavailable",
        message: "OIDC user information is temporarily unavailable.",
      },
      { cause },
    )
  }
}
