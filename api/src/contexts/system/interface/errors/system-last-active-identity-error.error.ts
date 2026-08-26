import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemLastActiveIdentityError extends SystemHTTPException {
  constructor() {
    super({ status: 409, code: "last_active_identity", detail: "last active identity" })
  }
}
