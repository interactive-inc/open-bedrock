import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** サイクルの管理操作（作成・開閉・結果閲覧）が許される権限を持つか判定する純粋関数。 */
export function canAdministerCycle(session: SessionPayload): boolean {
  return hasPermission(session, "review:administer")
}
