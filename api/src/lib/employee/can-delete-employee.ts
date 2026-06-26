import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 従業員台帳からの削除を行える権限を持つか判定する純粋関数。
 * 削除は不可逆かつ 43 件のカスケード DELETE を伴うため、employee:delete 権限に限定する。
 */
export function canDeleteEmployee(session: SessionPayload): boolean {
  return hasPermission(session, "employee:delete")
}
