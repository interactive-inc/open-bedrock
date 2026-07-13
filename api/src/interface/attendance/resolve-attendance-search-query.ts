import type { AttendanceSearchQuery } from "@/interface/attendance/attendance-search-query"
import type { Context } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"
import {
  listManagedEmployeeIds,
  resolveOrganizationAuthority,
} from "@/lib/org/organization-authority"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
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
export async function resolveAttendanceSearchQuery(
  c: Context,
  props: Props,
): Promise<AttendanceSearchQuery | ApplicationError> {
  const canViewOthers = hasPermission(props.viewerSession, "attendance:read:all")

  if (props.requestedEmployeeId === props.viewerEmployeeId) {
    return {
      employeeIds: [props.viewerEmployeeId],
      from: props.from,
      to: props.to,
    }
  }

  if (props.requestedEmployeeId !== null && canViewOthers === false) {
    return new ForbiddenError("cannot view other employee attendance", "forbidden")
  }

  if (props.requestedEmployeeId === null && canViewOthers === false) {
    return {
      employeeIds: [props.viewerEmployeeId],
      from: props.from,
      to: props.to,
    }
  }

  if (hasPermission(props.viewerSession, "org:manage")) {
    return {
      employeeIds: props.requestedEmployeeId === null ? null : [props.requestedEmployeeId],
      from: props.from,
      to: props.to,
    }
  }

  if (props.requestedEmployeeId !== null) {
    const authority = await resolveOrganizationAuthority(
      c,
      props.viewerEmployeeId,
      props.requestedEmployeeId,
    )

    if (authority instanceof Error) {
      return new UnexpectedError("failed to resolve organization authority", { cause: authority })
    }

    if (authority.managementChain === false && authority.departmentManager === false) {
      return new ForbiddenError("cannot view attendance outside organization scope", "forbidden")
    }

    return {
      employeeIds: [props.requestedEmployeeId],
      from: props.from,
      to: props.to,
    }
  }

  const managedEmployeeIds = await listManagedEmployeeIds(c, props.viewerEmployeeId)

  if (managedEmployeeIds instanceof Error) {
    return new UnexpectedError("failed to list managed employees", { cause: managedEmployeeIds })
  }

  return {
    employeeIds: [...new Set([props.viewerEmployeeId, ...managedEmployeeIds])],
    from: props.from,
    to: props.to,
  }
}
