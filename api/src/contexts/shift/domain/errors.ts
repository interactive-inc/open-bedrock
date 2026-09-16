import { DomainError } from "@system/domain/errors"

export type ShiftErrorCode = "forbidden" | "shift_conflict" | "shift_unavailable"

/** shift原記録の保全操作が成立しない理由。 */
export class ShiftError extends DomainError {
  constructor(
    readonly code: ShiftErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "ShiftError"
  }
}
