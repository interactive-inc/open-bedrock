import type { EmployeeRelation } from "@/lib/org/employee-relation"
import type { SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"

/**
 * 対象従業員の目標を閲覧できるか、スコープ(self/reports/department/all)で判定する。
 */
export function canReadGoalOf(session: SessionPayload, relation: EmployeeRelation): boolean {
  if (relation.isSelf) {
    return true
  }

  if (hasPermission(session, "goal:read:all")) {
    return true
  }

  if (relation.isReport && hasPermission(session, "goal:read:reports")) {
    return true
  }

  return relation.isSameDepartment && hasPermission(session, "goal:read:department")
}
