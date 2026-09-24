import { DomainError } from "@system/domain/errors"

export type ResignationErrorCode =
  | "forbidden"
  | "resignation_conflict"
  | "resignation_unavailable"
  | "company_authority_required"
  | "company_authority_unavailable"
  | "self_decision_forbidden"

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
