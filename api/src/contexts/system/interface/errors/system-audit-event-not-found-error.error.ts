import { SystemHTTPException } from "@system/interface/errors/system-http-exception.error"

export class SystemAuditEventNotFoundError extends SystemHTTPException {
  constructor() {
    super({ status: 404, code: "audit_event_not_found", detail: "audit event not found" })
  }
}
