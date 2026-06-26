import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 交換申請の承認・却下が可能な権限を持つか判定する純粋関数。 */
export function canDecideRedemption(session: SessionPayload): boolean {
  return hasPermission(session, "thanks_redemption:approve")
}
