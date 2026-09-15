import { DomainError } from "@system/domain/errors"

export type WorkAccidentErrorCode =
  | "forbidden"
  | "work_accident_conflict"
  | "work_accident_unavailable"

/** 労災・事故原記録の保全操作が成立しない理由。 */
export class WorkAccidentError extends DomainError {
  constructor(
    readonly code: WorkAccidentErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "WorkAccidentError"
  }
}
