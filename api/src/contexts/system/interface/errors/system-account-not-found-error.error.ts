import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAccountNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "account_not_found", detail: "account not found" })
  }
}
