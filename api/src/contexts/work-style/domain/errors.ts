import { DomainError } from "@system/domain/errors"

export type EmployeeWorkStyleErrorCode =
  | "forbidden"
  | "work_style_conflict"
  | "work_style_unavailable"

/** 勤務形態原記録の保全操作が成立しない理由。 */
export class EmployeeWorkStyleError extends DomainError {
  constructor(
    readonly code: EmployeeWorkStyleErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "EmployeeWorkStyleError"
  }
}
