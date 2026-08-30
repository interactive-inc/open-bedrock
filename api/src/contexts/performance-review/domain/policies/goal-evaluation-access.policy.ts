import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { EmployeeRelation } from "@/contexts/company/domain/definitions/employee-relation.definition"

/**
 * 対象従業員の目標を manager/final 評価できるか判定する。self は含めない。
 * 自己評価は resolve-evaluation-permission の self kind が担う。
 */
export function canEvaluateGoalOf(
  session: CompanySessionValue,
  relation: EmployeeRelation,
): boolean {
  if (session.hasPermission("goal:evaluate")) {
    return true
  }

  return relation.isReport && session.hasPermission("goal:evaluate:reports")
}
