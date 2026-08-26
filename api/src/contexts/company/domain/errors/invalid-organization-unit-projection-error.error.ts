import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidOrganizationUnitProjectionError extends DomainError {
  readonly code = "invalid_organization_unit_projection"

  constructor() {
    super("organization unit rows cannot be projected to the canonical model")
    this.name = "InvalidOrganizationUnitProjectionError"
  }
}
