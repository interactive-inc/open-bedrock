import { OIDCHTTPException } from "@system/interface/errors/oidchttp-exception.error"

export class OIDCInvalidRequestError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "invalid_request", cause })
  }
}
