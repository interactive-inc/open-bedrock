import { isoDate } from "@/lib/schemas"
import { InvalidBusinessDateError } from "@/lib/time/invalid-business-date-error"

/**
 * YYYY-MM-DD の翌暦日を返す。うるう年・月末・年跨ぎを UTC 基準で処理する。
 */
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
