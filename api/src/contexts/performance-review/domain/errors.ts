import { DomainError } from "@system/domain/errors"

export type PerformanceReviewErrorCode =
  | "forbidden"
  | "performance_review_conflict"
  | "performance_review_unavailable"

/** performanceReview原記録の保全操作が成立しない理由。 */
export class PerformanceReviewError extends DomainError {
  constructor(
    readonly code: PerformanceReviewErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "PerformanceReviewError"
  }
}
