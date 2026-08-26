import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemInvalidSessionError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_session", detail: "invalid session" })
  }
}
