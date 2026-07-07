import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 規程集の新規登録・新版追加・アーカイブを行える権限を持つか判定する。 */
export function canManageRegulations(session: SessionPayload): boolean {
  return hasPermission(session, "regulation:manage")
}
