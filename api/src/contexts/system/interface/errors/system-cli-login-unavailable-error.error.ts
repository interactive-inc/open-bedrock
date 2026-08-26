import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemCLILoginUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "cli_login_unavailable", detail: "CLI login is unavailable" })
  }
}
