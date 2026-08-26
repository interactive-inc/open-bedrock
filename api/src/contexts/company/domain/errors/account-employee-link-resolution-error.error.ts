import { DomainError } from "@/contexts/system/domain/errors"
import type { AccountEmployeeLinkResolutionCode } from "@/contexts/company/domain/errors.shared"

export class AccountEmployeeLinkResolutionError extends DomainError {
  constructor(readonly code: AccountEmployeeLinkResolutionCode) {
    super(code)
    this.name = "AccountEmployeeLinkResolutionError"
  }
}
