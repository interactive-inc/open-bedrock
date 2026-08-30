import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"

/**
 * 対象従業員の勤務形態を閲覧できるか判定する。本人か work_style:read:all を持つ場合に許可する。
 */
export function canReadWorkStylesOf(
  session: CompanySessionValue,
  targetEmployeeId: EmployeeId,
): boolean {
  if (session.employeeId === targetEmployeeId) {
    return true
  }

  return session.hasPermission("work_style:read:all")
}
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
