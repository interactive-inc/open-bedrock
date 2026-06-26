import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** バッチジョブ一覧の閲覧ができる権限を持つか判定する純粋関数。 */
export function canManageBatch(session: SessionPayload): boolean {
  return hasPermission(session, "batch:view")
}
