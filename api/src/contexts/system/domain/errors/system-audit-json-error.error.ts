import { DomainError } from "@system/domain/errors/domain-error.error"
import { toSystemAuditJsonErrorMessage } from "@system/domain/errors.shared"
import type { SystemAuditJsonErrorCode } from "@system/domain/errors.shared"

export class SystemAuditJsonError extends DomainError {
  readonly code: SystemAuditJsonErrorCode

  constructor(code: SystemAuditJsonErrorCode, options?: ErrorOptions) {
    super(toSystemAuditJsonErrorMessage(code), options)
    this.name = "SystemAuditJsonError"
    this.code = code
    Object.freeze(this)
  }
}
