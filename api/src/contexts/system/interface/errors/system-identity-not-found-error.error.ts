import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemIdentityNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "identity_not_found", detail: "identity not found" })
  }
}
