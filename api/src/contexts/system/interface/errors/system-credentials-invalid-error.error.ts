import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemCredentialsInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_credentials", detail: "invalid credentials" })
  }
}
