import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 産休・育休・介護休業の申出の状態を代理で進める権限（family_care_leave:manage）を持つか判定する純粋関数。 */
export function canManageFamilyCareLeaves(session: SessionPayload): boolean {
  return hasPermission(session, "family_care_leave:manage")
}
