import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 休暇申請を承認・却下できる権限を持つか判定する純粋関数。 */
export function canDecideLeave(session: SessionPayload): boolean {
  return hasPermission(session, "leave:approve")
}
