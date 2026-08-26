import { OIDCHTTPException } from "@system/interface/errors/oidchttp-exception.error"

export class OIDCTemporarilyUnavailableError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "temporarily_unavailable", status: 503, cause })
  }
}
