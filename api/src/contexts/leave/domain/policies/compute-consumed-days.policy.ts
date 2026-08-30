import type { LeaveUnit } from "@/contexts/leave/domain/definitions/leave-request.definition"

const STANDARD_WORK_HOURS_PER_DAY = 8

/** 取得単位から残数消費量（日数換算）を求める。半休は0.5日、時間休は時間数を8時間換算する。 */
export function computeConsumedDays(props: {
  unit: LeaveUnit
  hours: number | null
  days: number
}): number {
  if (props.unit === "hourly") {
    return (props.hours ?? 0) / STANDARD_WORK_HOURS_PER_DAY
  }

  if (props.unit === "half_day_am" || props.unit === "half_day_pm") {
    return 0.5
  }

  return props.days
}
