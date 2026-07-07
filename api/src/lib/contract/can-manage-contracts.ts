import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 契約記録の登録・更新を行える権限を持つか判定する。 */
export function canManageContracts(session: SessionPayload): boolean {
  return hasPermission(session, "contract:manage")
}
