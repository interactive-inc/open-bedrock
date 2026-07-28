import type { Session } from "@/lib/auth/session"
import type { EmployeeRelation } from "@/lib/org/employee-relation"

/**
 * 対象従業員の目標を閲覧できるか、スコープ(self/reports/department/all)で判定する。
 */
export function canReadGoalOf(session: Session, relation: EmployeeRelation): boolean {
  if (relation.isSelf) {
    return true
  }

  if (session.hasPermission("goal:read:all")) {
    return true
  }

  if (relation.isReport && session.hasPermission("goal:read:reports")) {
    return true
  }

  return relation.isSameDepartment && session.hasPermission("goal:read:department")
}
