import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidWorkforceStateError extends DomainError {
  readonly code = "invalid_workforce_state"

  constructor() {
    super("workforce state is not canonical")
    this.name = "InvalidWorkforceStateError"
  }
}
