import type { Session } from "@/domain/company/iam/session"

/**
 * 対象従業員の勤務形態を閲覧できるか判定する。本人か work_style:read:all を持つ場合に許可する。
 */
export function canReadWorkStylesOf(session: Session, targetEmployeeId: number): boolean {
  if (session.employeeId === targetEmployeeId) {
    return true
  }

  return session.hasPermission("work_style:read:all")
}
