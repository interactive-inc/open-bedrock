const millisecondsPerDay = 24 * 60 * 60 * 1000

export function toLeaveDays(startDate: string, endDate: string): number | Error {
  const start = Date.parse(`${startDate}T00:00:00Z`)

  const end = Date.parse(`${endDate}T00:00:00Z`)

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return new Error("invalid leave date")
  }

  if (end < start) {
    return new Error("end date precedes start date")
  }

  return (end - start) / millisecondsPerDay + 1
}
