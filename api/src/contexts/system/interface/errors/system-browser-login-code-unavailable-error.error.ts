import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemBrowserLoginCodeUnavailableError extends SystemHTTPException {
  constructor() {
    super({
      status: 503,
      code: "browser_login_code_unavailable",
      detail: "browser login is unavailable",
    })
  }
}
