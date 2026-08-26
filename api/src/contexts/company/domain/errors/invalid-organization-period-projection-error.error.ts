import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidOrganizationPeriodProjectionError extends DomainError {
  readonly code = "invalid_organization_period_projection"

  constructor() {
    super("organization period rows cannot be projected to the canonical workforce model")
    this.name = "InvalidOrganizationPeriodProjectionError"
  }
}
