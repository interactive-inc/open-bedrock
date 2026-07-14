import { isoDate } from "@/lib/schemas"

export class CompanyTimeZoneError extends Error {
  constructor(options?: ErrorOptions) {
    super("company time zone is unavailable", options)
    this.name = "CompanyTimeZoneError"
  }
}

export class InvalidBusinessDateError extends Error {
  constructor(options?: ErrorOptions) {
    super("business date is invalid", options)
    this.name = "InvalidBusinessDateError"
  }
}

export function resolveCompanyBusinessDate(props: {
  now: string
  timeZone: string | undefined
}): string | CompanyTimeZoneError {
  if (props.timeZone === undefined || props.timeZone.trim().length === 0) {
    return new CompanyTimeZoneError()
  }

  const instant = new Date(props.now)
  if (Number.isFinite(instant.getTime()) === false) {
    return new CompanyTimeZoneError()
  }

  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: props.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant)

    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    const value = `${year ?? ""}-${month ?? ""}-${day ?? ""}`

    return isoDate.safeParse(value).success ? value : new CompanyTimeZoneError()
  } catch (error) {
    return new CompanyTimeZoneError({ cause: error })
  }
}

export function nextCalendarDate(value: string): string | InvalidBusinessDateError {
  if (isoDate.safeParse(value).success === false) {
    return new InvalidBusinessDateError()
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)

  try {
    const result = date.toISOString().slice(0, 10)
    return isoDate.safeParse(result).success ? result : new InvalidBusinessDateError()
  } catch (error) {
    return new InvalidBusinessDateError({ cause: error })
  }
}

export function containsBusinessDate(props: {
  startsOn: string
  endsOn: string | null
  businessDate: string
}): boolean {
  if (
    isoDate.safeParse(props.startsOn).success === false ||
    isoDate.safeParse(props.businessDate).success === false ||
    (props.endsOn !== null && isoDate.safeParse(props.endsOn).success === false)
  ) {
    return false
  }

  if (props.endsOn !== null && props.startsOn >= props.endsOn) {
    return false
  }

  return (
    props.startsOn <= props.businessDate &&
    (props.endsOn === null || props.businessDate < props.endsOn)
  )
}
