import { DomainError } from "@system/domain/errors"

export type RecruitmentErrorCode = "forbidden" | "recruitment_conflict" | "recruitment_unavailable"

/** recruitment原記録の保全操作が成立しない理由。 */
export class RecruitmentError extends DomainError {
  constructor(
    readonly code: RecruitmentErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "RecruitmentError"
  }
}
