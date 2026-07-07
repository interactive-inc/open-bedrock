import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** ライフイベント届出の状態を代理で進める権限（life_event:manage）を持つか判定する純粋関数。 */
export function canManageLifeEvents(session: SessionPayload): boolean {
  return hasPermission(session, "life_event:manage")
}
