import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 経費の承認・却下が可能な権限を持つか判定する純粋関数。 */
export function canDecideExpense(session: SessionPayload): boolean {
  return hasPermission(session, "expense:approve")
}
