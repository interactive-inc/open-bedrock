import { DomainError } from "@system/domain/errors"

export type GovernanceErrorCode = "forbidden" | "governance_conflict" | "governance_unavailable"

/** governance原記録の保全操作が成立しない理由。 */
export class GovernanceError extends DomainError {
  constructor(
    readonly code: GovernanceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "GovernanceError"
  }
}
