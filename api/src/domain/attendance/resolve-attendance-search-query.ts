import type { AttendanceSearchQuery } from "@/domain/attendance/attendance-search-query"

const privilegedRoles: ReadonlyArray<string> = ["manager", "hr", "admin"]

export type AttendanceForbidden = { reason: "forbidden" }

export type Props = {
  requestedEmployeeId: number | null
  from: string | null
  to: string | null
  viewerEmployeeId: number
  viewerRole: string
}

// 検索条件を解決する。他人を指定したのに権限がなければ判別可能な失敗を返す。
export function resolveAttendanceSearchQuery(
  props: Props,
): AttendanceSearchQuery | AttendanceForbidden {
  if (props.requestedEmployeeId === null) {
    return { employeeId: props.viewerEmployeeId, from: props.from, to: props.to }
  }

  const isViewingOthers = props.requestedEmployeeId !== props.viewerEmployeeId

  const canViewOthers = privilegedRoles.includes(props.viewerRole)

  if (isViewingOthers && !canViewOthers) {
    return { reason: "forbidden" }
  }

  return { employeeId: props.requestedEmployeeId, from: props.from, to: props.to }
}
