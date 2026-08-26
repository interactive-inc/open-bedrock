import { DomainError } from "@/contexts/system/domain/errors"

export class CompanyUniqueConstraintError extends DomainError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "CompanyUniqueConstraintError"
  }
}
