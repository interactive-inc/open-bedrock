import type { AttendanceSearchQuery } from "@/interface/attendance/attendance-search-query"
import { hasPermission } from "@/lib/auth/has-permission"
import { ForbiddenError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { SessionPayload } from "@/env"

export type Props = {
  requestedEmployeeId: number | null
  from: string | null
  to: string | null
  viewerEmployeeId: number
  viewerSession: SessionPayload
}

// 検索条件を解決する。他人を指定したのに権限がなければ判別可能な失敗を返す。
export function resolveAttendanceSearchQuery(
  props: Props,
): AttendanceSearchQuery | ApplicationError {
  const canViewOthers = hasPermission(props.viewerSession, "attendance:read:all")

  // 社員未指定。attendance:read:all 保持者は全社一覧（employeeId: null で route が全件取得）、
  // 非保持者は自分のレコードのみにフォールバックする。
  if (props.requestedEmployeeId === null) {
    return {
      employeeId: canViewOthers ? null : props.viewerEmployeeId,
      from: props.from,
      to: props.to,
    }
  }

  const isViewingOthers = props.requestedEmployeeId !== props.viewerEmployeeId

  if (isViewingOthers && !canViewOthers) {
    return new ForbiddenError("cannot view other employee attendance", "forbidden")
  }

  return { employeeId: props.requestedEmployeeId, from: props.from, to: props.to }
}
