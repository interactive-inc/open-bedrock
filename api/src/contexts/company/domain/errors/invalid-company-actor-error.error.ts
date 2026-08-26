import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidCompanyActorError extends DomainError {
  readonly code = "invalid_company_actor"

  constructor() {
    super("company actor is not canonical")
    this.name = "InvalidCompanyActorError"
  }
}
