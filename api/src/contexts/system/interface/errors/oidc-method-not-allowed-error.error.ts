import { OIDCHTTPException } from "@system/interface/errors/oidchttp-exception.error"

export class OIDCMethodNotAllowedError extends OIDCHTTPException {
  constructor() {
    super({ code: "method_not_allowed", status: 405, allow: "GET, HEAD" })
  }
}
