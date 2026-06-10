export type MonthRange = {
  month: string
  from: string
  to: string
}

export function toMonthRange(month: string): MonthRange {
  const from = `${month}-01`

  const [yearStr, monthStr] = month.split("-")
  const year = Number(yearStr)
  const mon = Number(monthStr)
  const lastDay = new Date(year, mon, 0).getDate()

  const to = `${month}-${String(lastDay).padStart(2, "0")}`

  return { month, from, to }
}
