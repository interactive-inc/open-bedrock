import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 予算枠と消化記録の登録・更新を行える権限を持つか判定する。 */
export function canManageBudgets(session: SessionPayload): boolean {
  return hasPermission(session, "budget:manage")
}
