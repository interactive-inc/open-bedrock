import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemPasswordInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_password", detail: "invalid password" })
  }
}
