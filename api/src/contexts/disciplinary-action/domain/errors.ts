import { DomainError } from "@system/domain/errors"

export type DisciplinaryActionErrorCode =
  | "forbidden"
  | "disciplinary_action_conflict"
  | "disciplinary_action_unavailable"

/** 懲戒記録原記録の保全操作が成立しない理由。 */
export class DisciplinaryActionError extends DomainError {
  constructor(
    readonly code: DisciplinaryActionErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "DisciplinaryActionError"
  }
}
