import { DomainError } from "@system/domain/errors"

export type LifeEventErrorCode =
  | "forbidden"
  | "life_event_conflict"
  | "life_event_unavailable"

/** life event原記録の保全操作が成立しない理由。 */
export class LifeEventError extends DomainError {
  constructor(
    readonly code: LifeEventErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "LifeEventError"
  }
}
