import { DomainError } from "@system/domain/errors"

export type HeadcountPlanErrorCode =
  | "forbidden"
  | "headcount_plan_conflict"
  | "headcount_plan_unavailable"

/** 人員計画原記録の保全操作が成立しない理由。 */
export class HeadcountPlanError extends DomainError {
  constructor(
    readonly code: HeadcountPlanErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "HeadcountPlanError"
  }
}
