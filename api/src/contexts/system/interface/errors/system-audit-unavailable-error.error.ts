import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAuditUnavailableError extends SystemHTTPException {
  constructor() {
    super({ status: 503, code: "audit_unavailable", detail: "audit service unavailable" })
  }
}
