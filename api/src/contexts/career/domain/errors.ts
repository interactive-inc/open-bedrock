import { DomainError } from "@system/domain/errors"

export type CareerErrorCode = "forbidden" | "career_conflict" | "career_unavailable"

/** career原記録の保全操作が成立しない理由。 */
export class CareerError extends DomainError {
  constructor(
    readonly code: CareerErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "CareerError"
  }
}
