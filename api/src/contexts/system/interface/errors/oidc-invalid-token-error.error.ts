import { OIDCHTTPException } from "@system/interface/errors/oidchttp-exception.error"

export class OIDCInvalidTokenError extends OIDCHTTPException {
  constructor(cause?: unknown) {
    super({
      code: "invalid_token",
      status: 401,
      authenticate: 'Bearer error="invalid_token"',
      cause,
    })
  }
}
