export type MonthRange = {
  month: string
  from: string
  to: string
}

export function toMonthRange(month: string): MonthRange {
  const from = `${month}-01`

  const to = `${month}-31`

  return { month, from, to }
}
