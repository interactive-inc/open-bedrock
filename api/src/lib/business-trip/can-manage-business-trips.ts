import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 出張申請の状態を代理で進める権限（business_trip:manage）を持つか判定する純粋関数。 */
export function canManageBusinessTrips(session: SessionPayload): boolean {
  return hasPermission(session, "business_trip:manage")
}
