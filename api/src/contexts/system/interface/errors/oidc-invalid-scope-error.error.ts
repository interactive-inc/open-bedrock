import { OIDCHTTPException } from "@system/interface/errors/oidchttp-exception.error"

export class OIDCInvalidScopeError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({ code: "invalid_scope", cause })
  }
}
