import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 懲戒の記録を登録できる権限を持つか判定する（非公開・本人にも見せない）。 */
export function canManageDisciplinaryActions(session: SessionPayload): boolean {
  return hasPermission(session, "disciplinary_action:manage")
}
