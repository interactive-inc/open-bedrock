import type { Session } from "@/contexts/company/domain/iam/session"
import type { EmployeeRelation } from "@/contexts/company/domain/organization/employee-relation"

/**
 * 対象従業員の目標を manager/final 評価できるか判定する。self は含めない。
 * 自己評価は resolve-evaluation-permission の self kind が担う。
 */
export function canEvaluateGoalOf(session: Session, relation: EmployeeRelation): boolean {
  if (session.hasPermission("goal:evaluate")) {
    return true
  }

  return relation.isReport && session.hasPermission("goal:evaluate:reports")
}
