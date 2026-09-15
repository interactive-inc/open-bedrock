import { DomainError } from "@system/domain/errors"

export type CompensationChangeErrorCode =
  | "forbidden"
  | "compensation-change_conflict"
  | "compensation-change_unavailable"

/** compensation-change原記録の保全操作が成立しない理由。 */
export class CompensationChangeError extends DomainError {
  constructor(
    readonly code: CompensationChangeErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "CompensationChangeError"
  }
}
