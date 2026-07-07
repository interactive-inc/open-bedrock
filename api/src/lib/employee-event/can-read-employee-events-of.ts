import type { EmployeeRelation } from "@/lib/org/employee-relation"
import type { SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"

/**
 * 対象従業員の異動・在籍イベント履歴を閲覧できるか、スコープ(self/all)で判定する。
 */
export function canReadEmployeeEventsOf(
  session: SessionPayload,
  relation: EmployeeRelation,
): boolean {
  if (relation.isSelf) {
    return true
  }

  return hasPermission(session, "employee_event:read:all")
}
