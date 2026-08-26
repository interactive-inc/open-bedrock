import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAccountUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "account_unavailable", detail: "account service unavailable" })
  }
}
