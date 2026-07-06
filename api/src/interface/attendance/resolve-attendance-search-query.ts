import type { AttendanceSearchQuery } from "@/interface/attendance/attendance-search-query"
import { canReadAllAttendance } from "@/lib/attendance/can-read-all-attendance"
import { ForbiddenError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { SessionPayload } from "@/env"

export type Props = {
  requestedEmployeeId: number | null
  from: string | null
  to: string | null
  session: SessionPayload
}

// 検索条件を解決する。他人を指定したのに権限がなければ判別可能な失敗を返す。
export function resolveAttendanceSearchQuery(
  props: Props,
): AttendanceSearchQuery | ApplicationError {
  if (props.requestedEmployeeId === null) {
    return { employeeId: props.session.employeeId, from: props.from, to: props.to }
  }

  const isViewingOthers = props.requestedEmployeeId !== props.session.employeeId

  if (isViewingOthers && canReadAllAttendance(props.session) === false) {
    return new ForbiddenError("cannot view other employee attendance", "forbidden")
  }

  return { employeeId: props.requestedEmployeeId, from: props.from, to: props.to }
}
