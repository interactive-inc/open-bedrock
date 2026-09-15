import { DomainError } from "@system/domain/errors"

export type FamilyCareLeaveErrorCode =
  | "forbidden"
  | "family_care_leave_conflict"
  | "family_care_leave_unavailable"

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
