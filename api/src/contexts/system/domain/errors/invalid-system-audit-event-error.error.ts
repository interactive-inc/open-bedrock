import { DomainError } from "@system/domain/errors/domain-error.error"

export class InvalidSystemAuditEventError extends DomainError {
  readonly code = "invalid_system_audit_event"

  constructor(cause?: unknown) {
    super("System audit event is not canonical", cause === undefined ? {} : { cause })
    this.name = "InvalidSystemAuditEventError"
  }
}
