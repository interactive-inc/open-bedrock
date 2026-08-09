import type { Session } from "@/domain/company/iam/session"
import type { EmployeeRelation } from "@/lib/org/employee-relation"

/**
 * 対象従業員の等級履歴を閲覧できるか、スコープ(self/reports/all)で判定する。
 */
export function canReadGradeOf(session: Session, relation: EmployeeRelation): boolean {
  if (relation.isSelf) {
    return true
  }

  if (session.hasPermission("grade:read:all")) {
    return true
  }

  return relation.isReport && session.hasPermission("grade:read:reports")
}
