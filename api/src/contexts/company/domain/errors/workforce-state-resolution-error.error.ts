import { DomainError } from "@/contexts/system/domain/errors"
import type { WorkforceStateResolutionCode } from "@/contexts/company/domain/errors.shared"

export class WorkforceStateResolutionError extends DomainError {
  constructor(readonly code: WorkforceStateResolutionCode) {
    super(code)
    this.name = "WorkforceStateResolutionError"
  }
}
