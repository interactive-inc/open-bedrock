export class InvalidCalendarDateError extends Error {
  readonly code = "invalid_calendar_date"

  constructor() {
    super("invalid calendar date")
    this.name = "InvalidCalendarDateError"
  }
}
