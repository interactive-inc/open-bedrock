import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 役職マスタを管理できる権限を持つか判定する純粋関数。 */
export function canManagePositions(session: SessionPayload): boolean {
  return hasPermission(session, "position:manage")
}
