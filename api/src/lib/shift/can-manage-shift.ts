import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** シフトの作成・公開・部署横断検索ができる権限を持つか判定する純粋関数。 */
export function canManageShift(session: SessionPayload): boolean {
  return hasPermission(session, "shift:manage")
}
