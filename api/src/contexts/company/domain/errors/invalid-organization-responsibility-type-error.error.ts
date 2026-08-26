import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidOrganizationResponsibilityTypeError extends DomainError {
  readonly code = "invalid_organization_responsibility_type"

  constructor() {
    super("organization responsibility type is not canonical")
    this.name = "InvalidOrganizationResponsibilityTypeError"
  }
}
