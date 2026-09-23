import { DomainError } from "@system/domain/errors"

export type SurveyErrorCode = "forbidden" | "survey_conflict" | "survey_unavailable"

/** survey原記録の保全操作が成立しない理由。 */
export class SurveyError extends DomainError {
  constructor(
    readonly code: SurveyErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "SurveyError"
  }
}
