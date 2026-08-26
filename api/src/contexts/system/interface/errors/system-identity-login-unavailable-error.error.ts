import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemIdentityLoginUnavailableError extends SystemHTTPException {
  constructor() {
    super({
      status: 503,
      code: "identity_login_unavailable",
      detail: "identity login is unavailable",
    })
  }
}
