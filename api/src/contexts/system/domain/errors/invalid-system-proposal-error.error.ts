import { DomainError } from "@system/domain/errors/domain-error.error"
import type { InvalidSystemProposalCode } from "@system/domain/errors.shared"

export class InvalidSystemProposalError extends DomainError {
  readonly code: InvalidSystemProposalCode

  constructor(code: InvalidSystemProposalCode, options?: ErrorOptions) {
    super(code, options)
    this.name = "InvalidSystemProposalError"
    this.code = code
  }
}
