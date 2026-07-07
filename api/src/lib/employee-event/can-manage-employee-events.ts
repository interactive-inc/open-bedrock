import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 異動・在籍イベントの履歴を記録できる権限を持つか判定する純粋関数。 */
export function canManageEmployeeEvents(session: SessionPayload): boolean {
  return hasPermission(session, "employee_event:manage")
}
