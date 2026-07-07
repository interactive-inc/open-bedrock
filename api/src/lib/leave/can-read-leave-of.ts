import type { EmployeeRelation } from "@/lib/org/employee-relation"
import type { SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"

/**
 * 対象従業員の休暇申請・残数を閲覧できるか、スコープ(self/reports/department/all)で判定する。
 */
export function canReadLeaveOf(session: SessionPayload, relation: EmployeeRelation): boolean {
  if (relation.isSelf) {
    return true
  }

  if (hasPermission(session, "leave:read:all")) {
    return true
  }

  if (relation.isReport && hasPermission(session, "leave:read:reports")) {
    return true
  }

  return relation.isSameDepartment && hasPermission(session, "leave:read:department")
}
