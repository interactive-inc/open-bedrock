import type { Session } from "@/domain/company/iam/session"
import type { EmployeeRelation } from "@/lib/org/employee-relation"

/**
 * 対象従業員の勤怠を閲覧できるか、スコープ(self/reports/department/all)で判定する。
 */
export function canReadAttendanceOf(session: Session, relation: EmployeeRelation): boolean {
  if (relation.isSelf) {
    return true
  }

  if (session.hasPermission("attendance:read:all")) {
    return true
  }

  if (relation.isReport && session.hasPermission("attendance:read:reports")) {
    return true
  }

  return relation.isSameDepartment && session.hasPermission("attendance:read:department")
}
