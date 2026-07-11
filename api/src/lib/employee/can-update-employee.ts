import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 従業員台帳の既存従業員を更新できる権限を持つか判定する。 */
export function canUpdateEmployee(session: SessionPayload): boolean {
  return hasPermission(session, "employee:update")
}
