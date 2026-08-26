import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemLastRootIdentityError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "last_root", detail: "last root identity" })
  }
}
