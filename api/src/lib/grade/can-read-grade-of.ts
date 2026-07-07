import type { EmployeeRelation } from "@/lib/org/employee-relation"
import type { SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"

/**
 * 対象従業員の等級履歴を閲覧できるか、スコープ(self/reports/all)で判定する。
 */
export function canReadGradeOf(session: SessionPayload, relation: EmployeeRelation): boolean {
  if (relation.isSelf) {
    return true
  }

  if (hasPermission(session, "grade:read:all")) {
    return true
  }

  return relation.isReport && hasPermission(session, "grade:read:reports")
}
