import { DomainError } from "@/contexts/system/domain/errors"
import type { OrganizationalAuthorityErrorCode } from "@/contexts/company/domain/errors.shared"

export class OrganizationalAuthorityError extends DomainError {
  constructor(readonly code: OrganizationalAuthorityErrorCode) {
    super(code)
    this.name = "OrganizationalAuthorityError"
  }
}
