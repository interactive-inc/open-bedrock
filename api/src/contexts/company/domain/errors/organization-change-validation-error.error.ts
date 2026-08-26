import { DomainError } from "@/contexts/system/domain/errors"
import type { OrganizationChangeValidationCode } from "@/contexts/company/domain/errors.shared"

export class OrganizationChangeValidationError extends DomainError {
  constructor(readonly code: OrganizationChangeValidationCode) {
    super(code)
    this.name = "OrganizationChangeValidationError"
  }
}
