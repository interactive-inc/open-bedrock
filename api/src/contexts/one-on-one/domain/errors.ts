import { DomainError } from "@system/domain/errors"

export type OneOnOneErrorCode = "forbidden" | "one_on_one_conflict" | "one_on_one_unavailable"

/** 1on1原記録の保全操作が成立しない理由。 */
export class OneOnOneError extends DomainError {
  constructor(
    readonly code: OneOnOneErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "OneOnOneError"
  }
}
