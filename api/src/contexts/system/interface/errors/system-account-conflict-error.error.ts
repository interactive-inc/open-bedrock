import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAccountConflictError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "account_conflict", detail: "account conflict" })
  }
}
