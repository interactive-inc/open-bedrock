import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemPasswordUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "password_unavailable", detail: "password service unavailable" })
  }
}
