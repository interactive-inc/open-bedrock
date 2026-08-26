import { DomainError } from "@system/domain/errors/domain-error.error"

export class InvalidEmailError extends DomainError {
  readonly code = "invalid_email" as const

  constructor() {
    super("invalid_email")
    this.name = "InvalidEmailError"
    Object.freeze(this)
  }
}
