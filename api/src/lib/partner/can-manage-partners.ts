import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 取引先台帳の登録・更新・アーカイブを行える権限を持つか判定する。 */
export function canManagePartners(session: SessionPayload): boolean {
  return hasPermission(session, "partner:manage")
}
