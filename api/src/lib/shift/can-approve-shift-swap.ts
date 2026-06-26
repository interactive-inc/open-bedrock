import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** シフト交代の承認ができる権限を持つか判定する純粋関数。 */
export function canApproveShiftSwap(session: SessionPayload): boolean {
  return hasPermission(session, "shift_swap:approve")
}
