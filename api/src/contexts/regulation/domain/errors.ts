import { DomainError } from "@system/domain/errors"

export type RegulationErrorCode = "forbidden" | "regulation_conflict" | "regulation_unavailable"

/** regulation原記録の保全操作が成立しない理由。 */
export class RegulationError extends DomainError {
  constructor(
    readonly code: RegulationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "RegulationError"
  }
}
