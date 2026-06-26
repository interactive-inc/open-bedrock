import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** アカウントの作成・停止・失効・identity 管理を行える権限を持つか判定する純粋関数。 */
export function canManageAccounts(session: SessionPayload): boolean {
  return hasPermission(session, "account:manage")
}
