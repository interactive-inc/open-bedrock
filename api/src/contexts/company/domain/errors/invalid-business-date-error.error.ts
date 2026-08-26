import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidBusinessDateError extends DomainError {
  constructor(options?: ErrorOptions) {
    super("business date is invalid", options)
    this.name = "InvalidBusinessDateError"
  }
}
