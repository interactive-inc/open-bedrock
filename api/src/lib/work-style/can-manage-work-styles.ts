import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 従業員の勤務形態を管理できる権限（work_style:manage）を持つか判定する純粋関数。 */
export function canManageWorkStyles(session: SessionPayload): boolean {
  return hasPermission(session, "work_style:manage")
}
