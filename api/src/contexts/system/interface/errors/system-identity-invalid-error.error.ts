import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemIdentityInvalidError extends SystemHTTPException {
  constructor() {
    super({ status: 400, code: "invalid_identity", detail: "invalid identity" })
  }
}
