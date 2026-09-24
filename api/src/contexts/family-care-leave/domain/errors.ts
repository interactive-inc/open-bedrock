import { DomainError } from "@system/domain/errors"

export type FamilyCareLeaveErrorCode =
  | "forbidden"
  | "family_care_leave_conflict"
  | "family_care_leave_unavailable"
  | "company_authority_required"
  | "company_authority_unavailable"
  | "self_decision_forbidden"

/** family care leave原記録の保全操作が成立しない理由。 */
export class FamilyCareLeaveError extends DomainError {
  constructor(
    readonly code: FamilyCareLeaveErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "FamilyCareLeaveError"
  }
}
