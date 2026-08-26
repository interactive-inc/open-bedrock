import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemCLICodeInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 401, code: "invalid_cli_code", detail: "invalid CLI code" })
  }
}
