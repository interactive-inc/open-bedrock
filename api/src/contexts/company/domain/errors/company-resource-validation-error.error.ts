import { DomainError } from "@/contexts/system/domain/errors"
import type { CompanyResourceValidationCode } from "@/contexts/company/domain/errors.shared"

export class CompanyResourceValidationError extends DomainError {
  constructor(readonly code: CompanyResourceValidationCode) {
    super(code)
    this.name = "CompanyResourceValidationError"
  }
}
