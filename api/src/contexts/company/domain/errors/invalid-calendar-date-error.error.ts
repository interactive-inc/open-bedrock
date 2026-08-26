import { DomainError } from "@/contexts/system/domain/errors"

export class InvalidCalendarDateError extends DomainError {
  readonly code = "invalid_calendar_date"

  constructor() {
    super("invalid calendar date")
    this.name = "InvalidCalendarDateError"
  }
}
