import { DomainError } from "@system/domain/errors"

export type CommendationErrorCode =
  | "forbidden"
  | "commendation_conflict"
  | "commendation_unavailable"

/** 表彰原記録の保全操作が成立しない理由。 */
export class CommendationError extends DomainError {
  constructor(
    readonly code: CommendationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "CommendationError"
  }
}
