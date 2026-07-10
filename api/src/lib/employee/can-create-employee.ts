import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 従業員台帳へ新しい従業員を登録できる権限を持つか判定する。 */
export function canCreateEmployee(session: SessionPayload): boolean {
  return hasPermission(session, "employee:create")
}
