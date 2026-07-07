import type { EmployeeRelation } from "@/lib/org/employee-relation"
import type { SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"

/**
 * 対象従業員の勤怠を閲覧できるか、スコープ(self/reports/department/all)で判定する。
 */
export function canReadAttendanceOf(session: SessionPayload, relation: EmployeeRelation): boolean {
  if (relation.isSelf) {
    return true
  }

  if (hasPermission(session, "attendance:read:all")) {
    return true
  }

  if (relation.isReport && hasPermission(session, "attendance:read:reports")) {
    return true
  }

  return relation.isSameDepartment && hasPermission(session, "attendance:read:department")
}
