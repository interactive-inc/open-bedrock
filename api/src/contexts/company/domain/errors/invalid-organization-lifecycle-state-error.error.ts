import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidOrganizationLifecycleStateError extends DomainError {
  readonly code = "invalid_organization_lifecycle_state"

  constructor() {
    super("organization lifecycle state is missing or invalid")
    this.name = "InvalidOrganizationLifecycleStateError"
  }
}
