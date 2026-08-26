import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemIdentityLoginDeniedError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "identity_login_denied", detail: "identity login denied" })
  }
}
