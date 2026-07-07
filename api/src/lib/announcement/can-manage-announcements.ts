import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 社内アナウンスの作成・更新・公開・アーカイブを行える権限を持つか判定する。 */
export function canManageAnnouncements(session: SessionPayload): boolean {
  return hasPermission(session, "announcement:manage")
}
