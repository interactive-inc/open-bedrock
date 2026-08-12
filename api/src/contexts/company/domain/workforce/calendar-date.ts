declare const calendarDateBrand: unique symbol

export type CalendarDate = string & { readonly [calendarDateBrand]: true }

export class InvalidCalendarDateError extends Error {
  readonly code = "invalid_calendar_date"

  constructor() {
    super("invalid calendar date")
    this.name = "InvalidCalendarDateError"
  }
}

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

/** YYYY-MM-DDの実在する暦日だけを受理する。時刻・timezoneへ依存しない。 */
export function isCalendarDate(value: string): value is CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= (daysInMonth[month - 1] ?? 0)
}

export function restoreCalendarDate(value: string): CalendarDate {
  if (!isCalendarDate(value)) throw new InvalidCalendarDateError()
  return value
}
