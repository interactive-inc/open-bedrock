import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 懲戒の記録を閲覧できる権限を持つか判定する（本人にも開かない。read:all のみ）。 */
export function canReadDisciplinaryActions(session: SessionPayload): boolean {
  return hasPermission(session, "disciplinary_action:read:all")
}
