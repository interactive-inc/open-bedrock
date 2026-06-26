import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 従業員台帳の登録・更新を行える権限を持つか判定する純粋関数。 */
export function canManageEmployees(session: SessionPayload): boolean {
  return hasPermission(session, "employee:create")
}
