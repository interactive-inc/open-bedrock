import { DomainError } from "@/contexts/system/domain/errors"

export class CompanyTimeZoneError extends DomainError {
  constructor(options?: ErrorOptions) {
    super("company time zone is unavailable", options)
    this.name = "CompanyTimeZoneError"
  }
}
