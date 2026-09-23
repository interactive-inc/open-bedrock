import { DomainError } from "@system/domain/errors"

export type TrainingErrorCode = "forbidden" | "training_conflict" | "training_unavailable"

/** training原記録の保全操作が成立しない理由。 */
export class TrainingError extends DomainError {
  constructor(
    readonly code: TrainingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "TrainingError"
  }
}
