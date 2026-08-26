import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemLoginCodeInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_login_code", detail: "invalid or expired code" })
  }
}
