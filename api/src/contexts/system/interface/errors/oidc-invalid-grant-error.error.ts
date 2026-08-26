import { OIDCHTTPException } from "@system/interface/errors/oidchttp-exception.error"

export class OIDCInvalidGrantError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "invalid_grant", cause })
  }
}
