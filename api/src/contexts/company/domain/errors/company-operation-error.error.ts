import { DomainError } from "@/contexts/system/domain/errors"

export class CompanyOperationError extends DomainError {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = new.target.name
  }
}
