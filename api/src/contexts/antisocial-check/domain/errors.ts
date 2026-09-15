import { DomainError } from "@system/domain/errors"

export type AntisocialCheckErrorCode =
  | "forbidden"
  | "antisocial_check_conflict"
  | "antisocial_check_unavailable"

/** antisocial check原記録の保全操作が成立しない理由。 */
export class AntisocialCheckError extends DomainError {
  constructor(
    readonly code: AntisocialCheckErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "AntisocialCheckError"
  }
}
