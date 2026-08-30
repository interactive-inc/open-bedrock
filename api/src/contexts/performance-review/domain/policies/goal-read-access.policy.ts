import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { EmployeeRelation } from "@/contexts/company/domain/definitions/employee-relation.definition"

/**
 * 対象従業員の目標を閲覧できるか、スコープ(self/reports/department/all)で判定する。
 */
export function canReadGoalOf(session: CompanySessionValue, relation: EmployeeRelation): boolean {
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
