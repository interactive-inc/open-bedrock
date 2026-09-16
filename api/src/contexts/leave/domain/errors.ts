import { DomainError } from "@system/domain/errors"

export type LeaveErrorCode = "forbidden" | "leave_conflict" | "leave_unavailable"

/** leave原記録の保全操作が成立しない理由。 */
export class LeaveError extends DomainError {
  constructor(
    readonly code: LeaveErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "LeaveError"
  }
}
