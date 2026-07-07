import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** インシデント記録の登録・更新・解消を行える権限を持つか判定する。 */
export function canManageItIncidents(session: SessionPayload): boolean {
  return hasPermission(session, "it_incident:manage")
}
