import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemCLIAuthorizationInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_cli_authorization", detail: "invalid CLI authorization" })
  }
}
