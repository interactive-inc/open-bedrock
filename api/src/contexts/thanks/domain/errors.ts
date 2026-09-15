import { DomainError } from "@system/domain/errors"

export type ThanksErrorCode =
  | "forbidden"
  | "thanks_conflict"
  | "thanks_unavailable"

/** thanks原記録の保全操作が成立しない理由。 */
export class ThanksError extends DomainError {
  constructor(
    readonly code: ThanksErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "ThanksError"
  }
}
