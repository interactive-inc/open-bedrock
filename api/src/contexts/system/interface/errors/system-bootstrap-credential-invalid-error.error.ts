import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemBootstrapCredentialInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_credential", detail: "invalid bootstrap credential" })
  }
}
