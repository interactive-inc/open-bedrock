import type { EmployeeRelation } from "@/lib/org/employee-relation"
import type { SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"

/**
 * 対象従業員の目標を manager/final 評価できるか判定する。self は含めない。
 * 自己評価は resolve-evaluation-permission の self kind が担う。
 */
export function canEvaluateGoalOf(session: SessionPayload, relation: EmployeeRelation): boolean {
  if (hasPermission(session, "goal:evaluate")) {
    return true
  }

  return relation.isReport && hasPermission(session, "goal:evaluate:reports")
}
