import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 会社の意思決定記録の作成・更新・supersede を行える権限を持つか判定する純粋関数。 */
export function canManageDecisions(session: SessionPayload): boolean {
  return hasPermission(session, "decision:manage")
}
