import { ApplicationUnauthorizedError } from "@system/application/errors/application-unauthorized-error.error"

export class OidcInvalidTokenApplicationError extends ApplicationUnauthorizedError {
  constructor(cause?: unknown) {
    super({ error: "invalid_token", message: "The OIDC access token is invalid." }, { cause })
  }
}
