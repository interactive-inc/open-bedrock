import { DomainError } from "@system/domain/errors"

export type ResignationErrorCode =
  | "forbidden"
  | "resignation_conflict"
  | "resignation_unavailable"

/** resignation原記録の保全操作が成立しない理由。 */
export class ResignationError extends DomainError {
  constructor(
    readonly code: ResignationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "ResignationError"
  }
}
