export type CalendarOverride = {
  calendarDate: string
  kind: "holiday" | "workday"
}

/**
 * 指定月(YYYY-MM)の営業日数を数える純関数。
 * 既定は平日(月〜金)を営業日とし、会社休日(holiday)を除外、振替出勤日(workday)を加算する。
 * 法定判定ではなく、時間外の参考集計に用いる営業日数の目安。
 */
export function countBusinessDays(props: {
  month: string
  overrides: ReadonlyArray<CalendarOverride>
}): number {
  const year = Number(props.month.slice(0, 4))

  const monthNumber = Number(props.month.slice(5, 7))

  const overrideByDate = new Map<string, CalendarOverride["kind"]>()

  for (const override of props.overrides) {
    overrideByDate.set(override.calendarDate, override.kind)
  }

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()

  let businessDays = 0

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(Date.UTC(year, monthNumber - 1, day))

    const isoDate = `${props.month}-${String(day).padStart(2, "0")}`

    const override = overrideByDate.get(isoDate) ?? null

    if (override === "holiday") {
      continue
    }

    if (override === "workday") {
      businessDays += 1

      continue
    }

    const weekday = date.getUTCDay()

    const isWeekend = weekday === 0 || weekday === 6

    if (isWeekend === false) {
      businessDays += 1
    }
  }

  return businessDays
}
