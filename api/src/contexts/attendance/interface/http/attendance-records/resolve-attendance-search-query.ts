import type { Session } from "@/lib/auth/session"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { AttendanceSearchQuery } from "@/contexts/attendance/interface/http/attendance-records/attendance-search-query"
import { canReadAttendanceOf } from "@/contexts/attendance/interface/http/attendance-records/can-read-attendance-of"
import type { EmployeeRelation } from "@/contexts/company/domain/definitions/employee-relation.definition"
import { ForbiddenError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Props = {
  requestedEmployeeId: EmployeeId | null
  from: string | null
  to: string | null
  session: Session
  relation: EmployeeRelation | null
}

/**
 * 検索条件を解決する。他人を指定したのに権限がなければ判別可能な失敗を返す。
 * relation は他者アクセス時のみ渡す(self・null 時は本人検索)。
 */
export function resolveAttendanceSearchQuery(
  props: Props,
): AttendanceSearchQuery | ApplicationError {
  if (props.requestedEmployeeId === null) {
    return { employeeIds: [props.session.employeeId], from: props.from, to: props.to }
  }

  const isViewingOthers = props.requestedEmployeeId !== props.session.employeeId

  if (
    isViewingOthers &&
    (props.relation === null || canReadAttendanceOf(props.session, props.relation) === false)
  ) {
    return new ForbiddenError("cannot view other employee attendance", "forbidden")
  }

  return { employeeIds: [props.requestedEmployeeId], from: props.from, to: props.to }
}
