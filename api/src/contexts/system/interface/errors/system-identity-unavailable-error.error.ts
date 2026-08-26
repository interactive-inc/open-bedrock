import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemIdentityUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "identity_unavailable", detail: "identity service unavailable" })
  }
}
