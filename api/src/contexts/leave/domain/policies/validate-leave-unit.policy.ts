import type { LeaveUnit } from "@/contexts/leave/domain/definitions/leave-request.definition"

/** unit と申請内容の整合性を検証する。hourly は hours 必須、半休は単日のみ。 */
export function validateLeaveUnit(props: {
  unit: LeaveUnit
  hours: number | null
  startDate: string
  endDate: string
}): Error | null {
  if (props.unit === "hourly" && props.hours === null) {
    return new Error("hours is required when unit is hourly")
  }

  const isHalfDay = props.unit === "half_day_am" || props.unit === "half_day_pm"

  if (isHalfDay && props.startDate !== props.endDate) {
    return new Error("half day unit requires start_date to equal end_date")
  }

  return null
}
