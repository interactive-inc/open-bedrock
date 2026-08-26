import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemBootstrapInputInvalidError extends SystemHTTPException {
  constructor(code: string) {
    super({ status: 400, code, detail: "invalid bootstrap input" })
  }
}
