import type { Session } from "@/lib/auth/session"
import type { EmployeeRelation } from "@/contexts/company/domain/definitions/employee-relation.definition"

/**
 * 対象従業員の異動・在籍イベント履歴を閲覧できるか、スコープ(self/all)で判定する。
 */
export function canReadEmployeeEventsOf(session: Session, relation: EmployeeRelation): boolean {
  if (relation.isSelf) {
    return true
  }

  return session.hasPermission("employee_event:read:all")
}
