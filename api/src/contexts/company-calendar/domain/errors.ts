import { DomainError } from "@system/domain/errors"

export type CompanyCalendarDayErrorCode =
  | "forbidden"
  | "company_calendar_conflict"
  | "company_calendar_unavailable"

/** 会社カレンダー原記録の保全操作が成立しない理由。 */
export class CompanyCalendarDayError extends DomainError {
  constructor(
    readonly code: CompanyCalendarDayErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "CompanyCalendarDayError"
  }
}
